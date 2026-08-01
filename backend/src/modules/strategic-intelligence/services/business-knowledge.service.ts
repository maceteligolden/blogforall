import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import { MemoryRecordRepository } from "../../orchestrator/repositories/memory-record.repository";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import type { MemoryRecord } from "../../orchestrator/ai/contracts/memory-record";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import {
  BUSINESS_KNOWLEDGE_IMPORTANCE,
  BUSINESS_KNOWLEDGE_KEYS,
  BUSINESS_KNOWLEDGE_QUESTIONS,
  WORKSPACE_STRATEGIC_TO_KEY,
  type BusinessKnowledgeKey,
} from "../constants/business-knowledge.keys";
import { logger } from "../../../shared/utils/logger";

const ONBOARDING_CONFIDENCE = 0.55;
const GAP_CONFIDENCE_THRESHOLD = 0.6;

export type KnowledgeGap = {
  key: BusinessKnowledgeKey;
  importance: number;
  confidence: number;
  strategic_value: number;
  question: string;
  status: "missing" | "low_confidence";
};

@injectable()
export class BusinessKnowledgeService {
  constructor(
    private readonly records: MemoryRecordRepository,
    private readonly workspaceMemory: WorkspaceMemoryRepository
  ) {}

  async listBeliefs(siteId: string): Promise<MemoryRecord[]> {
    const [workspace, knowledge] = await Promise.all([
      this.records.listByLayer(siteId, "workspace", { limit: 100 }),
      this.records.listByLayer(siteId, "knowledge", { limit: 100 }),
    ]);
    return [...workspace, ...knowledge].filter((r) =>
      BUSINESS_KNOWLEDGE_KEYS.includes(r.canonical_key as BusinessKnowledgeKey)
    );
  }

  async getBelief(siteId: string, key: string): Promise<MemoryRecord | null> {
    const all = await this.listBeliefs(siteId);
    return all.find((r) => r.canonical_key === key) ?? null;
  }

  async upsertBelief(
    siteId: string,
    userId: string | undefined,
    key: BusinessKnowledgeKey | string,
    value: unknown,
    opts?: { confidence?: number; importance?: number; source?: string }
  ): Promise<MemoryRecord> {
    const now = new Date().toISOString();
    const valueText =
      typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
    const importance = opts?.importance ?? BUSINESS_KNOWLEDGE_IMPORTANCE[key as BusinessKnowledgeKey] ?? 0.7;
    const record: MemoryRecord = {
      id: `mr_${randomUUID()}`,
      workspace_id: siteId,
      user_id: null,
      layer: "workspace",
      canonical_key: key,
      value,
      value_text: valueText.slice(0, 8000),
      metadata: {
        created_at: now,
        updated_at: now,
        confidence: opts?.confidence ?? ONBOARDING_CONFIDENCE,
        importance,
        cognitive_kind: "semantic",
        version: 1,
        source_turn_id: opts?.source,
      },
    };
    const saved = await this.records.upsert(record);
    await this.projectHotKeys(siteId, userId);
    logger.info("Belief upserted", { siteId, key, confidence: saved.metadata.confidence }, "BusinessKnowledgeService");
    return saved;
  }

  async listGaps(siteId: string): Promise<KnowledgeGap[]> {
    const beliefs = await this.listBeliefs(siteId);
    const byKey = new Map(beliefs.map((b) => [b.canonical_key, b]));
    const gaps: KnowledgeGap[] = [];

    for (const key of BUSINESS_KNOWLEDGE_KEYS) {
      const belief = byKey.get(key);
      const importance = BUSINESS_KNOWLEDGE_IMPORTANCE[key];
      const confidence = belief?.metadata.confidence ?? 0;
      if (!belief || confidence < GAP_CONFIDENCE_THRESHOLD) {
        gaps.push({
          key,
          importance,
          confidence,
          strategic_value: importance * (1 - confidence),
          question: BUSINESS_KNOWLEDGE_QUESTIONS[key],
          status: !belief ? "missing" : "low_confidence",
        });
      }
    }

    return gaps.sort((a, b) => b.strategic_value - a.strategic_value);
  }

  async averageConfidence(siteId: string): Promise<number> {
    const beliefs = await this.listBeliefs(siteId);
    if (!beliefs.length) return 0.35;
    const sum = beliefs.reduce((acc, b) => acc + b.metadata.confidence, 0);
    return sum / beliefs.length;
  }

  /** Seed beliefs from WorkspaceMemory.strategic (idempotent upsert). */
  async seedFromWorkspaceMemory(siteId: string, userId?: string): Promise<number> {
    const memory = await this.workspaceMemory.ensureForSite(siteId, userId);
    let count = 0;
    const strategic = memory.strategic as unknown as Record<string, unknown>;

    for (const [field, key] of Object.entries(WORKSPACE_STRATEGIC_TO_KEY)) {
      const raw = strategic[field];
      if (raw == null) continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      if (typeof raw === "string" && !raw.trim()) continue;

      const existing = await this.getBelief(siteId, key);
      if (existing) continue;

      await this.upsertBelief(siteId, userId, key, raw, {
        confidence: ONBOARDING_CONFIDENCE,
        source: "onboarding",
      });
      count++;
    }
    return count;
  }

  /** Project hot keys back into WorkspaceMemory.strategic for cheap reads. */
  async projectHotKeys(siteId: string, userId?: string): Promise<void> {
    const beliefs = await this.listBeliefs(siteId);
    const byKey = new Map(beliefs.map((b) => [b.canonical_key, b]));
    const patch: Partial<WorkspaceMemory["strategic"]> = {};

    const type = byKey.get("business.type");
    if (type?.value_text) patch.business_type = type.value_text;
    const audience = byKey.get("business.audience");
    if (audience) {
      patch.target_audience = Array.isArray(audience.value)
        ? (audience.value as string[])
        : [String(audience.value_text ?? audience.value)];
    }
    const voice = byKey.get("business.brand_voice");
    if (voice?.value_text) patch.brand_voice = voice.value_text;
    const goals = byKey.get("business.goals");
    if (goals) {
      patch.business_goals = Array.isArray(goals.value)
        ? (goals.value as string[])
        : [String(goals.value_text ?? goals.value)];
    }
    const channels = byKey.get("business.publishing_channels");
    if (channels) {
      patch.publishing_channels = Array.isArray(channels.value)
        ? (channels.value as string[])
        : [String(channels.value_text ?? channels.value)];
    }
    const seo = byKey.get("business.seo_priorities");
    if (seo) {
      patch.seo_priorities = Array.isArray(seo.value) ? (seo.value as string[]) : [String(seo.value_text ?? seo.value)];
    }
    const competitors = byKey.get("business.competitors");
    if (competitors?.value_text) patch.competitive_notes = competitors.value_text;

    if (Object.keys(patch).length === 0) return;

    await this.workspaceMemory.update(siteId, { strategic: patch } as never, userId);
  }

  /** Confirm belief after supporting evidence (publish/analytics). */
  async confirmBelief(siteId: string, key: string, delta = 0.05): Promise<void> {
    const belief = await this.getBelief(siteId, key);
    if (!belief) return;
    const next = Math.min(0.98, belief.metadata.confidence + delta);
    await this.upsertBelief(siteId, undefined, key, belief.value, {
      confidence: next,
      importance: belief.metadata.importance,
      source: "analytics",
    });
  }
}
