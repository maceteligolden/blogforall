import { injectable } from "tsyringe";
import { ForbiddenError, NotFoundError } from "../../../shared/errors";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { SiteStatus } from "../../../shared/constants";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import {
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
} from "../../../shared/schemas/orchestrator-approval.schema";
import type { OrchestratorApproval } from "../../../shared/schemas/orchestrator-approval.schema";
import type { OrchestratorThread } from "../../../shared/schemas/orchestrator-thread.schema";
import { SiteService } from "../../site/services/site.service";
import { OrchestratorThreadRepository } from "../repositories/orchestrator-thread.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { OrchestratorApprovalRepository } from "../repositories/orchestrator-approval.repository";
import { WorkspaceMemoryRepository } from "../repositories/workspace-memory.repository";
import { OrchestratorGraphService } from "../ai/orchestrator-graph.service";
import { OrchestratorToolRegistry } from "../ai/tool-registry";
import { TokenEnforcementService } from "../../token-ledger/services/token-enforcement.service";
import { TokenLedgerFeature } from "../../../shared/constants/token-ledger.constant";
import {
  serializeApproval,
  type ChatTurnResponse,
  type OrchestratorTool,
  type SerializedApproval,
  type SupervisorDecision,
} from "../interfaces/orchestrator.interface";
import { ensureOnboardingInterviewReply } from "../utils/onboarding-interview.helper";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import {
  captureServerEvent,
  ServerAnalyticsEvents,
} from "../../../shared/analytics/posthog.server";

interface BaseTurnInput {
  siteId: string;
  userId: string;
  message: string;
  threadId?: string;
  requestId?: string;
}

/**
 * Side-effects layer for the Workspace Orchestrator Agent.
 *
 * Owns:
 *  - thread + memory bootstrapping (idempotent on every turn)
 *  - history loading and message persistence
 *  - planning via OrchestratorGraphService (pure)
 *  - approval row lifecycle (create, decide, re-run on approve)
 *  - memory patch application
 *  - onboarding completion (flips Site.status via SiteService)
 *
 * The graph is deliberately pure; this service is where every
 * `findOneAndUpdate` lives, so it's the only place to look for race
 * conditions or tenant-isolation bugs in the chat path.
 */
@injectable()
export class OrchestratorService {
  constructor(
    private readonly graphService: OrchestratorGraphService,
    private readonly threadRepository: OrchestratorThreadRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly toolRegistry: OrchestratorToolRegistry,
    private readonly siteService: SiteService,
    private readonly tokenEnforcement: TokenEnforcementService
  ) {}

  // ---------------------------------------------------------------------------
  // Public entry points
  // ---------------------------------------------------------------------------

  /**
   * Handle one user message in active (post-onboarding) mode. Creates a fresh
   * thread when `threadId` is not provided. Returns the full ChatTurnResponse
   * the controller serializes to the frontend.
   */
  async chat(input: BaseTurnInput): Promise<ChatTurnResponse> {
    return this.runTurn({ ...input, mode: "active" });
  }

  /**
   * Handle one user message in onboarding mode. The thread is forced to be
   * the workspace's single canonical onboarding thread regardless of
   * `threadId`; the supervisor's tool surface is constrained to
   * workspace.completeOnboarding.
   */
  async onboardingChat(
    input: Omit<BaseTurnInput, "threadId">
  ): Promise<ChatTurnResponse> {
    return this.runTurn({ ...input, mode: "onboarding" });
  }

  async listThreads(siteId: string, userId: string, limit = 50): Promise<OrchestratorThread[]> {
    await this.assertSiteAccess(siteId, userId);
    return this.threadRepository.listForUser(siteId, userId, { limit });
  }

  async getThreadWithMessages(
    threadId: string,
    siteId: string,
    userId: string
  ): Promise<{ thread: OrchestratorThread; messages: OrchestratorMessage[] }> {
    await this.assertSiteAccess(siteId, userId);
    const thread = await this.threadRepository.findById(threadId, siteId);
    if (!thread) {
      throw new NotFoundError("Thread not found");
    }
    if (thread.user_id !== userId) {
      throw new ForbiddenError("You do not have access to this thread");
    }
    const messages = await this.messageRepository.listByThread(threadId, siteId);
    return { thread, messages };
  }

  async renameThread(
    threadId: string,
    siteId: string,
    userId: string,
    title: string
  ): Promise<OrchestratorThread> {
    await this.assertSiteAccess(siteId, userId);
    const thread = await this.threadRepository.findById(threadId, siteId);
    if (!thread) {
      throw new NotFoundError("Thread not found");
    }
    if (thread.user_id !== userId) {
      throw new ForbiddenError("You do not have access to this thread");
    }
    const updated = await this.threadRepository.rename(threadId, siteId, title);
    if (!updated) {
      throw new NotFoundError("Thread not found");
    }
    return updated;
  }

  async listApprovals(
    siteId: string,
    userId: string,
    status?: OrchestratorApprovalStatus,
    limit = 100
  ): Promise<SerializedApproval[]> {
    await this.assertSiteAccess(siteId, userId);
    const rows = await this.approvalRepository.listForUser(siteId, userId, { status, limit });
    return rows.map(serializeApproval);
  }

  /**
   * Manually decide an approval (e.g. from the approvals page rather than the
   * chat reply). When the decision is `approved` we re-run the gated tool
   * inside this service's context and record the outcome.
   */
  async decideApproval(
    siteId: string,
    userId: string,
    approvalId: string,
    decision: "approved" | "rejected",
    note?: string
  ): Promise<OrchestratorApproval> {
    await this.assertSiteAccess(siteId, userId);
    const decided = await this.approvalRepository.decide(
      approvalId,
      siteId,
      decision === "approved"
        ? OrchestratorApprovalStatus.APPROVED
        : OrchestratorApprovalStatus.REJECTED,
      userId,
      note
    );
    if (!decided) {
      throw new NotFoundError("Approval not found or already decided");
    }
    if (decision === "approved") {
      await this.executeApprovedAction(decided, userId);
    }
    return decided;
  }

  // ---------------------------------------------------------------------------
  // Core turn loop
  // ---------------------------------------------------------------------------

  private async runTurn(
    input: BaseTurnInput & { mode: "active" | "onboarding" }
  ): Promise<ChatTurnResponse> {
    const { siteId, userId, message, mode } = input;
    await this.assertSiteAccess(siteId, userId);

    const site = await this.siteService.getSiteById(siteId, userId);
    if (mode === "active" && site.status === SiteStatus.ONBOARDING) {
      throw new ForbiddenError(
        "Workspace onboarding is not complete. Use the onboarding chat to finish setup."
      );
    }

    const memory = await this.memoryRepository.ensureForSite(siteId, userId);

    const thread = await this.resolveThread(siteId, userId, input.threadId, mode);
    const history = await this.messageRepository.listByThread(thread._id!.toString(), siteId, {
      limit: env.orchestrator.maxThreadMessages,
    });

    logger.info(
      "Orchestrator turn started",
      {
        component: "orchestrator",
        event: "turn_start",
        siteId,
        userId,
        threadId: thread._id?.toString(),
        mode,
        historyLoaded: history.length,
      },
      "OrchestratorService"
    );

    // Sweep any in-chat confirmations that have aged out before planning.
    await this.approvalRepository.expireDue(siteId);

    // If the latest assistant turn left an unresolved approval, interpret
    // this user message as a decision on it (yes/cancel/etc.).
    const pendingApproval = await this.approvalRepository.findPendingForThread(
      thread._id!.toString(),
      siteId
    );
    if (pendingApproval && this.shortCircuitConfirmationReply(message, pendingApproval)) {
      return this.resolveConfirmationFromText(siteId, userId, thread, pendingApproval, message);
    }

    const feature =
      mode === "onboarding"
        ? TokenLedgerFeature.ORCHESTRATOR_ONBOARDING
        : TokenLedgerFeature.ORCHESTRATOR_CHAT;

    const contextText = JSON.stringify({
      strategic: memory.strategic,
      preferences: memory.preferences,
      memory_summary: memory.memory_summary,
      historyCount: history.length,
    });

    return this.tokenEnforcement.runWithReservation({
      userId,
      siteId,
      feature,
      requestId: input.requestId,
      estimate: {
        feature,
        promptText: message,
        contextText,
      },
      fn: async () => {
        await this.messageRepository.create({
          thread_id: thread._id!.toString(),
          site_id: siteId,
          role: OrchestratorMessageRole.USER,
          content: message,
        });

        const plan = await this.graphService.planTurn({
          siteId,
          userId,
          threadId: thread._id!.toString(),
          workspaceName: site.name,
          workspaceId: siteId,
          mode,
          memory,
          history,
          newUserMessage: message,
        });

        const historyForApply = await this.messageRepository.listByThread(
          thread._id!.toString(),
          siteId,
          { limit: env.orchestrator.maxThreadMessages }
        );
        return this.applyPlan(siteId, userId, thread, plan, mode, memory, historyForApply);
      },
    });
  }

  /**
   * Persist whatever the graph produced and run the side effects implied by
   * `decision.next` (approval creation, memory write, onboarding flip, etc.).
   */
  private async applyPlan(
    siteId: string,
    userId: string,
    thread: OrchestratorThread,
    plan: Awaited<ReturnType<OrchestratorGraphService["planTurn"]>>,
    mode: "active" | "onboarding",
    workspaceMemory?: WorkspaceMemory,
    threadHistory?: OrchestratorMessage[]
  ): Promise<ChatTurnResponse> {
    const rawNext = plan.decision.next;
    let decision = plan.decision;
    let assistantReply = plan.assistant_reply;
    let pendingApproval: OrchestratorApproval | null = null;
    let onboardingCompleted = false;
    let workspaceStatus: "onboarding" | "active" =
      mode === "onboarding" ? "onboarding" : "active";

    // During onboarding the model often chooses `update_memory` with an empty
    // `reply`, which surfaces only as the generic graph fallback ("I'll update
    // the workspace memory…") and tends to repeat on the next user turn (see
    // debug session H6). We still persist `memory_patch`, but coerce the stored
    // decision to `respond` with a concrete follow-up so the chat advances.
    if (mode === "onboarding" && rawNext === "update_memory") {
      const ack =
        (decision.reply && decision.reply.trim()) ||
        (assistantReply && assistantReply.trim()) ||
        "Thanks — I've saved that to your workspace profile. What would you like to refine next — target audience, brand voice, or where you'll publish?";
      decision = { ...decision, next: "respond", reply: ack };
      assistantReply = ack;
    }

    if (plan.tool_invocation) {
      await this.messageRepository.create({
        thread_id: thread._id!.toString(),
        site_id: siteId,
        role: OrchestratorMessageRole.TOOL,
        content: plan.tool_invocation.summary,
        tool_name: plan.tool_invocation.name,
      });
    }

    if (decision.next === "request_confirmation" && decision.confirmation) {
      pendingApproval = await this.approvalRepository.create({
        site_id: siteId,
        thread_id: thread._id!.toString(),
        requested_for_user_id: userId,
        requested_by_user_id: userId,
        kind: decision.confirmation.kind,
        action: decision.confirmation.action,
        summary: decision.confirmation.summary,
        payload: decision.confirmation.payload,
        expires_at: new Date(Date.now() + env.orchestrator.confirmTimeoutMs),
      });
      if (!assistantReply) {
        assistantReply = decision.confirmation.summary;
      }
    }

    const hasMemoryPatch =
      !!decision.memory_patch && Object.keys(decision.memory_patch).length > 0;
    if (
      hasMemoryPatch &&
      (rawNext === "update_memory" || (mode === "onboarding" && decision.next !== "complete_onboarding"))
    ) {
      await this.memoryRepository.update(siteId, decision.memory_patch as never, userId);
    }

    if (mode === "onboarding" && decision.next !== "complete_onboarding" && workspaceMemory) {
      const memoryAfterPatch =
        (await this.memoryRepository.findBySiteId(siteId)) ?? workspaceMemory;
      const repaired = ensureOnboardingInterviewReply(
        assistantReply,
        memoryAfterPatch,
        threadHistory
      );
      if (repaired.repaired) {
        assistantReply = repaired.reply;
        decision = { ...decision, next: "respond", reply: assistantReply };
      }
    }

    if (decision.next === "complete_onboarding" && mode === "onboarding") {
      await this.completeOnboarding(siteId, userId, thread, decision);
      onboardingCompleted = true;
      workspaceStatus = "active";
      captureServerEvent(ServerAnalyticsEvents.WORKSPACE_ONBOARDING_COMPLETED, {
        userId,
        workspaceId: siteId,
      });
    }

    const assistant = await this.messageRepository.create({
      thread_id: thread._id!.toString(),
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: assistantReply || "(no reply)",
      tool_calls: plan.tool_invocation
        ? [
            {
              tool: plan.tool_invocation.name,
              input: plan.tool_invocation.input,
              output_summary: plan.tool_invocation.summary,
              output_data: plan.tool_invocation.data,
              errored: !plan.tool_invocation.ok,
              error_message: plan.tool_invocation.error,
            },
          ]
        : undefined,
      pending_approval_id: pendingApproval?._id?.toString(),
    });

    await this.threadRepository.touch(thread._id!.toString());

    const messagesPruned = await this.pruneOrchestratorThread(thread._id!.toString(), siteId);
    logger.info(
      "Orchestrator turn completed",
      {
        component: "orchestrator",
        event: "turn_complete",
        siteId,
        userId,
        threadId: thread._id?.toString(),
        mode,
        messagesPruned,
        hadToolCall: !!plan.tool_invocation,
        rawSupervisorNext: rawNext,
        decisionNext: decision.next,
      },
      "OrchestratorService"
    );

    return {
      thread_id: thread._id!.toString(),
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at,
      },
      tool_calls: plan.tool_invocation
        ? [{ tool: plan.tool_invocation.name, summary: plan.tool_invocation.summary }]
        : [],
      pending_approval: pendingApproval ? serializeApproval(pendingApproval) : null,
      workspace_status: workspaceStatus,
      onboarding_completed: onboardingCompleted,
    };
  }

  // ---------------------------------------------------------------------------
  // Confirmation resolution (in-chat yes/no shortcut)
  // ---------------------------------------------------------------------------

  /**
   * Cheap heuristic: when the user's message is a clear yes/no on a pending
   * approval, we skip the LLM and resolve it directly. The LLM is still in
   * the loop for ambiguous replies — those fall through to runTurn.
   */
  private shortCircuitConfirmationReply(message: string, _approval: OrchestratorApproval): boolean {
    const m = message.trim().toLowerCase();
    if (!m) return false;
    return (
      m === "yes" ||
      m === "y" ||
      m === "confirm" ||
      m === "do it" ||
      m === "go ahead" ||
      m === "approved" ||
      m === "no" ||
      m === "n" ||
      m === "cancel" ||
      m === "abort" ||
      m === "stop" ||
      m === "rejected"
    );
  }

  private async resolveConfirmationFromText(
    siteId: string,
    userId: string,
    thread: OrchestratorThread,
    approval: OrchestratorApproval,
    message: string
  ): Promise<ChatTurnResponse> {
    const isApprove = /\b(yes|y|confirm|do it|go ahead|approved)\b/i.test(message.trim());
    await this.messageRepository.create({
      thread_id: thread._id!.toString(),
      site_id: siteId,
      role: OrchestratorMessageRole.USER,
      content: message,
    });

    const decided = await this.approvalRepository.decide(
      approval._id!.toString(),
      siteId,
      isApprove ? OrchestratorApprovalStatus.APPROVED : OrchestratorApprovalStatus.REJECTED,
      userId
    );
    if (!decided) {
      // Race: another device already decided it. Just acknowledge.
      const reply = "That action was already decided on another device.";
      const assistant = await this.messageRepository.create({
        thread_id: thread._id!.toString(),
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: reply,
      });
      await this.threadRepository.touch(thread._id!.toString());
      await this.pruneOrchestratorThread(thread._id!.toString(), siteId);
      return this.buildSimpleResponse(thread, assistant, "active");
    }

    let reply: string;
    let toolSummary: string | undefined;
    let toolName: string | undefined;
    let toolOk = false;

    if (isApprove) {
      const exec = await this.executeApprovedAction(decided, userId);
      toolName = decided.action;
      toolSummary = exec.summary;
      toolOk = exec.ok;
      reply = exec.ok
        ? `Done. ${exec.summary}`
        : `I couldn't complete '${decided.action}': ${exec.summary}`;
    } else {
      reply = "Got it — I won't proceed.";
    }

    if (toolSummary && toolName) {
      await this.messageRepository.create({
        thread_id: thread._id!.toString(),
        site_id: siteId,
        role: OrchestratorMessageRole.TOOL,
        content: toolSummary,
        tool_name: toolName,
      });
    }

    const assistant = await this.messageRepository.create({
      thread_id: thread._id!.toString(),
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: reply,
      tool_calls:
        toolName && toolSummary
          ? [
              {
                tool: toolName,
                input: (decided.payload ?? {}) as Record<string, unknown>,
                output_summary: toolSummary,
                errored: !toolOk,
              },
            ]
          : undefined,
    });
    await this.threadRepository.touch(thread._id!.toString());

    const messagesPruned = await this.pruneOrchestratorThread(thread._id!.toString(), siteId);
    logger.info(
      "Orchestrator confirmation resolved",
      {
        component: "orchestrator",
        event: "confirmation_resolved",
        siteId,
        userId,
        threadId: thread._id?.toString(),
        isApprove,
        messagesPruned,
      },
      "OrchestratorService"
    );

    return {
      thread_id: thread._id!.toString(),
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at,
      },
      tool_calls: toolName && toolSummary ? [{ tool: toolName, summary: toolSummary }] : [],
      pending_approval: null,
      workspace_status: "active",
      onboarding_completed: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Execution helpers
  // ---------------------------------------------------------------------------

  /**
   * Run the tool referenced by an approved approval, then mark the approval
   * as executed. Tools are looked up by their `action` string; if the action
   * is not a tool (e.g. memory_update, scheduled_post_review), specialized
   * handlers in future phases plug in here.
   */
  /**
   * Best-effort recovery for confirmations the supervisor stored with a
   * free-text action (e.g. "publish blog post") or aliased payload keys
   * (e.g. `blog_id` instead of `id`). The exact-name case is checked first;
   * fallbacks are limited to a tight allowlist so we never invoke a tool the
   * user didn't approve.
   */
  private recoverConfirmationTarget(approval: OrchestratorApproval): {
    tool: OrchestratorTool | undefined;
    normalizedAction: string;
    normalizedPayload: Record<string, unknown>;
    recoveryNotes: string[];
  } {
    const rawAction = (approval.action || "").trim();
    const rawPayload = (approval.payload ?? {}) as Record<string, unknown>;
    const notes: string[] = [];

    // 1. Exact match — the happy path.
    let tool = this.toolRegistry.get(rawAction);
    let normalizedAction = rawAction;

    // 2. Free-text action — match against a small allowlist of destructive
    //    verbs. We only map to gated tools so we never escalate.
    if (!tool) {
      const lower = rawAction.toLowerCase();
      const aliasMap: Array<{ test: RegExp; tool: string }> = [
        { test: /\b(publish|go live)\b/, tool: "blogs.publish" },
        { test: /\b(unpublish|take down)\b/, tool: "blogs.unpublish" },
        { test: /\b(delete|remove).*(blog|post|article)\b/, tool: "blogs.delete" },
        { test: /\b(delete|remove).*(category|categories|topic|tag)\b/, tool: "categories.delete" },
        { test: /\b(cancel|stop).*(schedule|publishing)\b/, tool: "blogs.cancelSchedule" },
      ];
      for (const alias of aliasMap) {
        if (alias.test.test(lower)) {
          const candidate = this.toolRegistry.get(alias.tool);
          if (candidate) {
            tool = candidate;
            normalizedAction = alias.tool;
            notes.push(`action_alias:${rawAction}->${alias.tool}`);
            break;
          }
        }
      }
    }

    // 3. Payload key normalization. The blog tools all use `id`; the
    //    supervisor often emits `blog_id` / `post_id`. Same for categories.
    const normalizedPayload: Record<string, unknown> = { ...rawPayload };
    const keyAliases: Array<[string, string]> = [
      ["blog_id", "id"],
      ["post_id", "id"],
      ["postId", "id"],
      ["blogId", "id"],
      ["category_id", "id"],
      ["categoryId", "id"],
    ];
    for (const [from, to] of keyAliases) {
      if (from in normalizedPayload && !(to in normalizedPayload)) {
        normalizedPayload[to] = normalizedPayload[from];
        delete normalizedPayload[from];
        notes.push(`payload_alias:${from}->${to}`);
      }
    }

    return { tool, normalizedAction, normalizedPayload, recoveryNotes: notes };
  }

  private async executeApprovedAction(
    approval: OrchestratorApproval,
    userId: string
  ): Promise<{ ok: boolean; summary: string; data?: unknown }> {
    if (approval.kind === OrchestratorApprovalKind.IN_CHAT_CONFIRMATION) {
      // The supervisor sometimes drifts and stores a free-text description in
      // `action` (e.g. "publish blog post") or off-schema payload keys (e.g.
      // `blog_id` instead of `id`). Recover before failing so the user's
      // explicit "yes" still lands. (Debug H20/H21.)
      const { tool, normalizedPayload } = this.recoverConfirmationTarget(approval);
      if (!tool) {
        const summary = `Tool '${approval.action}' is not registered.`;
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: false,
          error: summary,
        });
        return { ok: false, summary };
      }
      try {
        const result = await tool.run({
          siteId: approval.site_id,
          userId,
          threadId: approval.thread_id || "",
          input: normalizedPayload,
        });
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: true,
          summary: result.summary,
          data: result.data,
        });
        return { ok: true, summary: result.summary, data: result.data };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: false,
          error: msg,
        });
        return { ok: false, summary: msg };
      }
    }

    // Approvals raised by the scheduled-post review flow and campaign-proposal
    // tools are executed by their owning services (Phase 6/7); we just mark
    // the approval as executed here without running anything.
    await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
      ok: true,
      summary: `Approval recorded for ${approval.action}.`,
    });
    return { ok: true, summary: `Approval recorded for ${approval.action}.` };
  }

  private async completeOnboarding(
    siteId: string,
    userId: string,
    thread: OrchestratorThread,
    decision: SupervisorDecision
  ): Promise<void> {
    const payload = (decision.onboarding_payload ?? {}) as Record<string, unknown>;
    const memoryPatch = this.buildMemoryPatchFromOnboardingPayload(payload);

    if (Object.keys(memoryPatch).length > 0) {
      await this.memoryRepository.update(siteId, memoryPatch as never, userId);
    }
    await this.siteService.markSiteActive(siteId, userId);
    await this.threadRepository.markOnboardingComplete(thread._id!.toString(), siteId);

    logger.info(
      "Workspace onboarding completed via orchestrator",
      { siteId, userId, threadId: thread._id?.toString() },
      "OrchestratorService"
    );
  }

  /**
   * Build a WorkspaceMemory patch from the orchestrator's `onboarding_payload`.
   *
   * The supervisor system prompt instructs the LLM to capture strategic fields
   * at the TOP level of the payload (e.g. `business_type`, `business_goals`,
   * `target_audience`, ...). We map those into the persisted
   * `WorkspaceMemory.strategic` / `.preferences` shape.
   *
   * Nested forms (`payload.strategic`, `payload.preferences`,
   * `payload.operational`) are still accepted so future prompt revisions don't
   * silently drop context.
   */
  private buildMemoryPatchFromOnboardingPayload(
    payload: Record<string, unknown>
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    const strategic: Record<string, unknown> = {};
    const preferences: Record<string, unknown> = {};
    const operational: Record<string, unknown> = {};

    const STRATEGIC_KEYS = [
      "business_type",
      "brand_voice",
      "target_audience",
      "business_goals",
      "seo_priorities",
      "publishing_channels",
    ] as const;
    for (const key of STRATEGIC_KEYS) {
      if (payload[key] !== undefined && payload[key] !== null) {
        strategic[key] = payload[key];
      }
    }
    if (payload.strategic && typeof payload.strategic === "object" && !Array.isArray(payload.strategic)) {
      Object.assign(strategic, payload.strategic as Record<string, unknown>);
    }

    const PREFERENCE_KEYS = ["tone", "default_word_count", "preferred_format"] as const;
    for (const key of PREFERENCE_KEYS) {
      if (payload[key] !== undefined && payload[key] !== null) {
        preferences[key] = payload[key];
      }
    }
    if (
      payload.preferences &&
      typeof payload.preferences === "object" &&
      !Array.isArray(payload.preferences)
    ) {
      Object.assign(preferences, payload.preferences as Record<string, unknown>);
    }

    const OPERATIONAL_KEYS = [
      "publishing_cadence",
      "approval_rules",
      "review_lead_time_hours",
      "automation_settings",
    ] as const;
    for (const key of OPERATIONAL_KEYS) {
      if (payload[key] !== undefined && payload[key] !== null) {
        operational[key] = payload[key];
      }
    }
    if (
      payload.operational &&
      typeof payload.operational === "object" &&
      !Array.isArray(payload.operational)
    ) {
      Object.assign(operational, payload.operational as Record<string, unknown>);
    }

    if (Object.keys(strategic).length > 0) patch.strategic = strategic;
    if (Object.keys(preferences).length > 0) patch.preferences = preferences;
    if (Object.keys(operational).length > 0) patch.operational = operational;
    if (typeof payload.memory_summary === "string" && payload.memory_summary.trim()) {
      patch.memory_summary = payload.memory_summary;
    }
    return patch;
  }

  // ---------------------------------------------------------------------------
  // Thread + access helpers
  // ---------------------------------------------------------------------------

  private async resolveThread(
    siteId: string,
    userId: string,
    threadId: string | undefined,
    mode: "active" | "onboarding"
  ): Promise<OrchestratorThread> {
    if (mode === "onboarding") {
      const existing = await this.threadRepository.findOnboardingThread(siteId, userId);
      if (existing) return existing;
      return this.threadRepository.create({
        site_id: siteId,
        user_id: userId,
        title: "Workspace onboarding",
        is_onboarding: true,
      });
    }
    if (threadId) {
      const found = await this.threadRepository.findById(threadId, siteId);
      if (!found) {
        throw new NotFoundError("Thread not found");
      }
      if (found.user_id !== userId) {
        throw new ForbiddenError("You do not have access to this thread");
      }
      return found;
    }
    return this.threadRepository.create({
      site_id: siteId,
      user_id: userId,
      title: "New conversation",
    });
  }

  /**
   * Persisted message cap: drop oldest rows so Mongo stays bounded even when
   * the supervisor loads only the latest N in memory.
   */
  private async pruneOrchestratorThread(threadId: string, siteId: string): Promise<number> {
    const n = await this.messageRepository.pruneThreadToMaxKeep(
      threadId,
      siteId,
      env.orchestrator.maxThreadMessages
    );
    if (n > 0) {
      logger.info(
        "Orchestrator thread pruned",
        {
          component: "orchestrator",
          event: "thread_pruned",
          siteId,
          threadId,
          messagesDeleted: n,
          maxKeep: env.orchestrator.maxThreadMessages,
        },
        "OrchestratorService"
      );
    }
    return n;
  }

  private async assertSiteAccess(siteId: string, userId: string): Promise<void> {
    const has = await this.siteService.hasSiteAccess(siteId, userId);
    if (!has) {
      throw new ForbiddenError("You do not have access to this workspace");
    }
  }

  private buildSimpleResponse(
    thread: OrchestratorThread,
    assistant: OrchestratorMessage,
    workspaceStatus: "onboarding" | "active"
  ): ChatTurnResponse {
    return {
      thread_id: thread._id!.toString(),
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at,
      },
      tool_calls: [],
      pending_approval: null,
      workspace_status: workspaceStatus,
      onboarding_completed: false,
    };
  }
}
