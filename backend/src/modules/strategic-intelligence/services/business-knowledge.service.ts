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
  FIELD_PATH_TO_KEY,
  WORKSPACE_PREFERENCE_TO_KEY,
  WORKSPACE_STRATEGIC_TO_KEY,
  confidenceForSource,
  type BeliefSource,
  type BeliefStatus,
  type BusinessKnowledgeKey,
} from "../constants/business-knowledge.keys";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";

const GAP_CONFIDENCE_THRESHOLD = 0.6;

export type KnowledgeGap = {
  key: BusinessKnowledgeKey;
  importance: number;
  confidence: number;
  strategic_value: number;
  question: string;
  status: "missing" | "low_confidence";
};

export type UpsertBeliefOpts = {
  confidence?: number;
  importance?: number;
  source?: BeliefSource | string;
  status?: BeliefStatus;
  /** Skip projecting hot keys (batch writers call project once). */
  skipProject?: boolean;
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
    opts?: UpsertBeliefOpts
  ): Promise<MemoryRecord> {
    const now = new Date().toISOString();
    const valueText =
      typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
    const importance = opts?.importance ?? BUSINESS_KNOWLEDGE_IMPORTANCE[key as BusinessKnowledgeKey] ?? 0.7;
    const source = opts?.source ?? "onboarding_backfill";
    const confidence = confidenceForSource(source, opts?.confidence);
    const existing = await this.getBelief(siteId, key);
    let status: BeliefStatus = opts?.status ?? (existing ? "updated" : "new");
    if (opts?.status) status = opts.status;

    const record: MemoryRecord = {
      id: existing?.id ?? `mr_${randomUUID()}`,
      workspace_id: siteId,
      user_id: null,
      layer: "workspace",
      canonical_key: key,
      value,
      value_text: valueText.slice(0, 8000),
      metadata: {
        created_at: existing?.metadata.created_at ?? now,
        updated_at: now,
        confidence,
        importance,
        cognitive_kind: "semantic",
        version: existing?.metadata.version ?? 1,
        source_turn_id: source,
        source,
        belief_status: status,
      },
    };
    const saved = await this.records.upsert(record);
    if (!opts?.skipProject) {
      await this.projectHotKeys(siteId, userId);
    }
    logger.info(
      "Belief upserted",
      { siteId, key, confidence: saved.metadata.confidence, source, status },
      "BusinessKnowledgeService"
    );
    return saved;
  }

  /**
   * Single-writer entry for WorkspaceMemory.strategic (+ mapped preference) patches.
   * Upserts beliefs for mapped fields, then projects hot keys; writes unmapped
   * strategic fields (e.g. website_url) and non-strategic body directly.
   */
  async applyStrategicPatch(
    siteId: string,
    userId: string | undefined,
    patch: {
      strategic?: Record<string, unknown>;
      preferences?: Record<string, unknown>;
      [key: string]: unknown;
    },
    source: BeliefSource | string = "user_explicit"
  ): Promise<WorkspaceMemory | null> {
    const strategic = patch.strategic ?? {};
    const preferences = patch.preferences ?? {};
    let beliefWrites = 0;

    if (env.orchestrator.strategicIntelligenceEnabled) {
      for (const [field, key] of Object.entries(WORKSPACE_STRATEGIC_TO_KEY)) {
        const raw = strategic[field];
        if (raw == null) continue;
        if (Array.isArray(raw) && raw.length === 0) continue;
        if (typeof raw === "string" && !raw.trim()) continue;
        await this.upsertBelief(siteId, userId, key, raw, { source, skipProject: true });
        beliefWrites++;
      }
      for (const [field, key] of Object.entries(WORKSPACE_PREFERENCE_TO_KEY)) {
        const raw = preferences[field];
        if (raw == null || (typeof raw === "string" && !raw.trim())) continue;
        await this.upsertBelief(siteId, userId, key, raw, { source, skipProject: true });
        beliefWrites++;
      }
      if (beliefWrites > 0) {
        await this.projectHotKeys(siteId, userId);
      }
    }

    // Residual WorkspaceMemory writes: unmapped strategic fields + full preferences/ops/etc.
    // Mapped strategic fields are already projected via projectHotKeys when SI is on.
    const memoryPatch: Record<string, unknown> = { ...patch };
    if (env.orchestrator.strategicIntelligenceEnabled) {
      const residualStrategic: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(strategic)) {
        if (!(k in WORKSPACE_STRATEGIC_TO_KEY) && v !== undefined) residualStrategic[k] = v;
      }
      if (Object.keys(residualStrategic).length > 0) memoryPatch.strategic = residualStrategic;
      else delete memoryPatch.strategic;
      // Preferences still written directly (tone also projected from belief).
      if (!patch.preferences || Object.keys(preferences).length === 0) delete memoryPatch.preferences;
    }

    if (Object.keys(memoryPatch).length === 0) {
      return this.workspaceMemory.ensureForSite(siteId, userId);
    }
    return this.workspaceMemory.update(siteId, memoryPatch as never, userId);
  }

  /** Map extraction field_path + value onto a belief when recognized. */
  async upsertFromFieldPath(
    siteId: string,
    userId: string | undefined,
    fieldPath: string,
    value: unknown,
    opts?: { confidence?: number; source?: BeliefSource | string }
  ): Promise<MemoryRecord | null> {
    const key = FIELD_PATH_TO_KEY[fieldPath] ?? FIELD_PATH_TO_KEY[fieldPath.replace(/^strategic\./, "")];
    if (!key) return null;
    let parsed: unknown = value;
    if (typeof value === "string" && (value.startsWith("[") || value.includes(","))) {
      if (
        key === "business.audience" ||
        key === "business.goals" ||
        key === "business.seo_priorities" ||
        key === "business.publishing_channels"
      ) {
        try {
          const json = JSON.parse(value);
          if (Array.isArray(json)) parsed = json;
          else parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        } catch {
          parsed = value.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
    }
    return this.upsertBelief(siteId, userId, key, parsed, {
      source: opts?.source ?? "conversation",
      confidence: opts?.confidence,
    });
  }

  async listGaps(siteId: string): Promise<KnowledgeGap[]> {
    const beliefs = await this.listBeliefs(siteId);
    const byKey = new Map(beliefs.map((b) => [b.canonical_key, b]));
    const gaps: KnowledgeGap[] = [];

    for (const key of BUSINESS_KNOWLEDGE_KEYS) {
      const belief = byKey.get(key);
      const importance = BUSINESS_KNOWLEDGE_IMPORTANCE[key];
      const meta = belief?.metadata as MemoryRecord["metadata"] & { belief_status?: BeliefStatus };
      if (meta?.belief_status === "invalidated") {
        gaps.push({
          key,
          importance,
          confidence: 0,
          strategic_value: importance,
          question: BUSINESS_KNOWLEDGE_QUESTIONS[key],
          status: "missing",
        });
        continue;
      }
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
    const active = beliefs.filter((b) => {
      const status = (b.metadata as { belief_status?: BeliefStatus }).belief_status;
      return status !== "invalidated";
    });
    if (!active.length) return 0.35;
    const sum = active.reduce((acc, b) => acc + b.metadata.confidence, 0);
    return sum / active.length;
  }

  /** Seed beliefs from WorkspaceMemory.strategic (idempotent upsert). */
  async seedFromWorkspaceMemory(
    siteId: string,
    userId?: string,
    source: BeliefSource | string = "onboarding"
  ): Promise<number> {
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
        source,
        status: "new",
        skipProject: true,
      });
      count++;
    }
    if (memory.preferences?.tone) {
      const existing = await this.getBelief(siteId, "business.tone");
      if (!existing) {
        await this.upsertBelief(siteId, userId, "business.tone", memory.preferences.tone, {
          source,
          status: "new",
          skipProject: true,
        });
        count++;
      }
    }
    if (count > 0) await this.projectHotKeys(siteId, userId);
    return count;
  }

  /** Project hot keys back into WorkspaceMemory.strategic for cheap reads. */
  async projectHotKeys(siteId: string, userId?: string): Promise<void> {
    const beliefs = await this.listBeliefs(siteId);
    const byKey = new Map(
      beliefs
        .filter((b) => (b.metadata as { belief_status?: BeliefStatus }).belief_status !== "invalidated")
        .map((b) => [b.canonical_key, b])
    );
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

    const prefsPatch: Partial<WorkspaceMemory["preferences"]> = {};
    const tone = byKey.get("business.tone");
    if (tone?.value_text) prefsPatch.tone = tone.value_text;

    if (Object.keys(patch).length === 0 && Object.keys(prefsPatch).length === 0) return;

    const update: Record<string, unknown> = {};
    if (Object.keys(patch).length) update.strategic = patch;
    if (Object.keys(prefsPatch).length) update.preferences = prefsPatch;
    await this.workspaceMemory.update(siteId, update as never, userId);
  }

  /** Confirm belief after supporting evidence (publish/analytics). */
  async confirmBelief(siteId: string, key: string, delta = 0.05): Promise<void> {
    const belief = await this.getBelief(siteId, key);
    if (!belief) return;
    const status = (belief.metadata as { belief_status?: BeliefStatus }).belief_status;
    if (status === "invalidated") return;
    const next = Math.min(0.98, belief.metadata.confidence + delta);
    await this.upsertBelief(siteId, undefined, key, belief.value, {
      confidence: next,
      importance: belief.metadata.importance,
      source: "analytics",
      status: "confirmed",
    });
  }

  /** Soft-invalidate a belief (confidence → 0, status invalidated). */
  async invalidateBelief(siteId: string, key: string, reason?: string): Promise<void> {
    const belief = await this.getBelief(siteId, key);
    if (!belief) return;
    await this.upsertBelief(siteId, undefined, key, {
      ...(typeof belief.value === "object" && belief.value && !Array.isArray(belief.value)
        ? (belief.value as object)
        : { prior: belief.value }),
      invalidated_reason: reason ?? "contradicted",
    }, {
      confidence: 0,
      importance: belief.metadata.importance,
      source: "analytics",
      status: "invalidated",
    });
  }
}
