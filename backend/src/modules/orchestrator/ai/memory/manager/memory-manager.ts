import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import type { WorkspaceMemory } from "../../../../../shared/schemas/workspace-memory.schema";
import { ContextPackBuilderService } from "../../../../memory/services/context-pack-builder.service";
import { MemoryExtractionService } from "../../../../memory/services/memory-extraction.service";
import { WorkspaceMemoryRepository } from "../../../repositories/workspace-memory.repository";
import {
  memoryCandidateSchema,
  type MemoryCandidate,
  type RememberResult,
} from "../../contracts/memory-record";

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
  preferences: never[];
  knowledge: never[];
  learning: never[];
  content_intelligence: never[];
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
    const prompt_block = this.packs.toPromptBlock(pack);
    const token_budget_used = Math.min(
      ctx.token_budget ?? 2000,
      Math.ceil(prompt_block.length / 4),
    );

    return {
      workspace_slice: {
        brand_voice: memory.strategic?.brand_voice,
        target_audience: memory.strategic?.target_audience,
        business_goals: memory.strategic?.business_goals,
        seo_priorities: memory.strategic?.seo_priorities,
        preferences: memory.preferences,
      },
      preferences: [],
      knowledge: [],
      learning: [],
      content_intelligence: [],
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
  async rememberAsync(
    candidate: MemoryCandidate,
    opts?: { turn_id?: string },
  ): Promise<{ job_id: string }> {
    const parsed = memoryCandidateSchema.parse({
      ...candidate,
      turn_id: opts?.turn_id ?? candidate.turn_id,
    });
    const job_id = randomUUID();
    void this.runRememberJob(parsed, job_id);
    return { job_id };
  }

  /** Sync path for onboarding-required fields. */
  async remember(candidate: MemoryCandidate): Promise<RememberResult> {
    const parsed = memoryCandidateSchema.parse(candidate);
    const record_id = parsed.id ?? randomUUID();
    await this.runRememberJob({ ...parsed, id: record_id }, randomUUID());
    return { status: "stored", record_id };
  }

  private async runRememberJob(candidate: MemoryCandidate, _jobId: string): Promise<void> {
    if (candidate.proposed_layer === "discard") return;
    if (!candidate.user_id) return;
    await this.extraction.processTurn({
      siteId: candidate.workspace_id,
      userId: candidate.user_id,
      threadId: candidate.turn_id,
      userMessage: candidate.text ?? String(candidate.proposed_value ?? ""),
      assistantReply: "",
      sessionMode: "planning",
    });
  }

  private profileToSessionMode(
    profile: RetrievalProfile,
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
