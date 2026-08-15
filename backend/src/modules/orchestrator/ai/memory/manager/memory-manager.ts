import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import type { WorkspaceMemory } from "../../../../../shared/schemas/workspace-memory.schema";
import { ContextPackBuilderService } from "../../../../memory/services/context-pack-builder.service";
import { MemoryExtractionService } from "../../../../memory/services/memory-extraction.service";
import { MemoryRecordRepository } from "../../../repositories/memory-record.repository";
import { WorkspaceMemoryRepository } from "../../../repositories/workspace-memory.repository";
import { UserRepository } from "../../../../auth/repositories/user.repository";
import {
  memoryCandidateSchema,
  memoryRecordSchema,
  type MemoryCandidate,
  type MemoryRecord,
  type RememberResult,
} from "../../contracts/memory-record";
import { customersHaveContent } from "../../../../../shared/types/business-profile";
import { migrateStrategicMemory } from "../../../../../shared/utils/migrate-strategic-memory";

function listSetupGaps(memory: WorkspaceMemory): string[] {
  const gaps: string[] = [];
  const s = migrateStrategicMemory(memory.strategic);
  if (!s.business_description?.trim()) gaps.push("business_description");
  if (!customersHaveContent(s.customers) && !s.target_audience?.length) gaps.push("customers");
  if (!s.brand_voice?.trim()) gaps.push("brand_voice");
  if (!s.business_goals?.length) gaps.push("business_goals");
  if (!s.publishing_channels?.length) gaps.push("publishing_channels");
  return gaps;
}

export type RetrievalProfile =
  | "chat_light"
  | "strategy_full"
  | "research_full"
  | "write_full"
  | "optimize_full"
  | string;

export type RetrievalContext = {
  workspace_id: string;
  user_id?: string;
  thread_id?: string;
  profile: RetrievalProfile;
  topic?: string;
  user_message?: string;
  /** When provided, skip repository fetch (enrich-only path). */
  workspace_memory?: WorkspaceMemory;
  token_budget?: number;
};

export type MemoryRetrievalResult = {
  workspace_slice?: Record<string, unknown>;
  preferences: MemoryRecord[];
  knowledge: MemoryRecord[];
  learning: MemoryRecord[];
  content_intelligence: MemoryRecord[];
  session_summary?: string;
  recent_messages_tail?: unknown[];
  artifacts?: Record<string, unknown>;
  prompt_block?: string;
  token_budget_used: number;
  profile: string;
};

/**
 * Memory Manager facade (doc 18).
 * Skills/orchestrator call this instead of repositories / ContextPackBuilder directly.
 */
@injectable()
export class MemoryManagerService {
  constructor(
    private readonly packs: ContextPackBuilderService,
    private readonly extraction: MemoryExtractionService,
    private readonly workspaceMemory: WorkspaceMemoryRepository,
    private readonly memoryRecords: MemoryRecordRepository,
    private readonly userRepository: UserRepository
  ) {}

  async retrieve(ctx: RetrievalContext): Promise<MemoryRetrievalResult> {
    const memory =
      ctx.workspace_memory ??
      (await this.workspaceMemory.findBySiteId(ctx.workspace_id)) ??
      (await this.workspaceMemory.ensureForSite(ctx.workspace_id));

    const sessionMode = this.profileToSessionMode(ctx.profile);
    const pack = await this.packs.build({
      siteId: ctx.workspace_id,
      memory,
      userMessage: ctx.user_message ?? ctx.topic ?? "",
      sessionMode,
      includeVectors: ctx.profile !== "chat_light",
    });
    let prompt_block = this.packs.toPromptBlock(pack);

    let company_role: string | undefined;
    let company_role_detail: string | undefined;
    if (ctx.user_id) {
      const user = await this.userRepository.findById(ctx.user_id);
      company_role = user?.company_role;
      company_role_detail = user?.company_role_detail;
      if (company_role) {
        const detail = company_role_detail ? ` (${company_role_detail})` : "";
        prompt_block += `\n\n[USER COMPANY ROLE]\nSpeak to this person as a ${company_role}${detail}. Tailor business advice to their role.`;
      }
    }

    const setup_gaps = listSetupGaps(memory);
    if (setup_gaps.length) {
      prompt_block += `\n\n[SETUP GAPS]\nWorkspace profile still missing: ${setup_gaps.join(", ")}. When the user wants to finish setup, ask only about these — do not invent values.`;
    }

    const token_budget_used = Math.min(ctx.token_budget ?? 2000, Math.ceil(prompt_block.length / 4));

    const [preferences, knowledge, learning, content_intelligence] = await Promise.all([
      this.memoryRecords.listByLayer(ctx.workspace_id, "user_preference", {
        userId: ctx.user_id,
        limit: 20,
      }),
      this.memoryRecords.listByLayer(ctx.workspace_id, "knowledge", { limit: 10 }),
      this.memoryRecords.listByLayer(ctx.workspace_id, "learning", { limit: 10 }),
      this.memoryRecords.listByLayer(ctx.workspace_id, "content_intelligence", { limit: 10 }),
    ]);

    const strategic = migrateStrategicMemory(memory.strategic);
    return {
      workspace_slice: {
        business_description: strategic.business_description,
        business_model: strategic.business_model,
        industries: strategic.industries,
        brand_voice: strategic.brand_voice,
        brand_negatives: strategic.brand_negatives,
        target_audience: strategic.target_audience,
        customers: strategic.customers,
        competitors: strategic.competitors,
        business_goals: strategic.business_goals,
        seo_priorities: strategic.seo_priorities,
        preferences: memory.preferences,
        company_role,
        company_role_detail,
        setup_gaps,
      },
      preferences,
      knowledge,
      learning,
      content_intelligence,
      session_summary: pack.episodic || undefined,
      prompt_block,
      token_budget_used,
      profile: ctx.profile,
    };
  }

  /**
   * Async remember — M2 uses in-process best-effort (Bull queue later).
   * Never blocks the caller beyond enqueue.
   */
  async rememberAsync(candidate: MemoryCandidate, opts?: { turn_id?: string }): Promise<{ job_id: string }> {
    const parsed = memoryCandidateSchema.parse({
      ...candidate,
      turn_id: opts?.turn_id ?? candidate.turn_id,
    });
    const job_id = randomUUID();
    void this.runRememberJob(parsed, job_id);
    return { job_id };
  }

  /** Sync path for onboarding-required fields / preference keys. */
  async remember(candidate: MemoryCandidate): Promise<RememberResult> {
    const parsed = memoryCandidateSchema.parse(candidate);
    const record_id = parsed.id ?? randomUUID();
    const result = await this.runRememberJob({ ...parsed, id: record_id }, randomUUID());
    return result;
  }

  private async runRememberJob(candidate: MemoryCandidate, _jobId: string): Promise<RememberResult> {
    if (candidate.proposed_layer === "discard") {
      return { status: "discarded" };
    }

    let record_id = candidate.id;

    if (candidate.proposed_layer && candidate.proposed_key) {
      const now = new Date().toISOString();
      const record = memoryRecordSchema.parse({
        id: candidate.id ?? randomUUID(),
        workspace_id: candidate.workspace_id,
        user_id: candidate.user_id ?? null,
        layer: candidate.proposed_layer,
        canonical_key: candidate.proposed_key,
        value: candidate.proposed_value ?? candidate.text ?? null,
        value_text: candidate.text ?? String(candidate.proposed_value ?? ""),
        metadata: {
          created_at: now,
          updated_at: now,
          confidence: candidate.confidence ?? 0.7,
          importance: candidate.confidence ?? 0.7,
          source_turn_id: candidate.turn_id,
          version: 1,
        },
      });
      const saved = await this.memoryRecords.upsert(record);
      record_id = saved.id;
    }

    if (candidate.user_id) {
      await this.extraction.processTurn({
        siteId: candidate.workspace_id,
        userId: candidate.user_id,
        threadId: candidate.turn_id,
        userMessage: candidate.text ?? String(candidate.proposed_value ?? ""),
        assistantReply: "",
        sessionMode: "planning",
      });
    }

    return { status: "stored", record_id };
  }

  private profileToSessionMode(
    profile: RetrievalProfile
  ): "planning" | "writing" | "research" | "review" | "casual" | "strategy" {
    switch (profile) {
      case "write_full":
        return "writing";
      case "optimize_full":
        return "review";
      case "research_full":
        return "research";
      case "strategy_full":
        return "strategy";
      case "chat_light":
      default:
        return "planning";
    }
  }
}
