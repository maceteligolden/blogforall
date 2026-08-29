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
import { buildNextOnboardingQuestion, ensureOnboardingInterviewReply } from "../utils/onboarding-interview.helper";
import {
  extractWebsiteUrl,
  isAffirmativeReply,
  isBusinessContextRefreshIntent,
  isNoWebsiteReply,
  isRejectReply,
  proposalToMemoryPatch,
  WEBSITE_ONBOARDING_QUESTION,
} from "../utils/website-onboarding.helper";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import { WebsiteIngestService } from "./website-ingest.service";
import { captureServerEvent, ServerAnalyticsEvents } from "../../../shared/analytics/posthog.server";
import { CampaignRoadmapService } from "../../campaign/services/campaign-roadmap.service";
import { OnboardingService, type SetupProgress } from "../../onboarding/services/onboarding.service";
import { ContextPackBuilderService } from "../../memory/services/context-pack-builder.service";
import { MemoryExtractionService } from "../../memory/services/memory-extraction.service";
import {
  SessionModeRouterService,
  type OperationalSessionMode,
  type SessionModeResolution,
} from "./session-mode-router.service";
import { ensureCasualConversationReply } from "../utils/casual-conversation.helper";
import { ensureVoiceConversationReply } from "../utils/voice-conversation.helper";
import { ensureConversationContinuation, type SelectionContextPayload } from "../utils/selection-focus.helper";
import { buildEnrichedUserMessage, type ClientSessionMode } from "../utils/turn-context.helper";
import { canRunOrchestratorTool } from "../../../shared/utils/site-permissions.util";
import { OrchestratorV05GraphService } from "../ai/graph/orchestrator-v05-graph.service";
import { buildV05MoatSnapshot } from "../ai/observability/moat-snapshot";
import { ConversationIntelligenceService } from "../ai/conversation-intelligence/conversation-intelligence";
import type { ConversationContext } from "../ai/contracts/conversation-context";
import { RealtimeService, REALTIME_EVENTS } from "../../../shared/realtime";
import type { WorkflowPhaseEvent } from "../ai/observability/phase-emitter";
import { NotificationService } from "../../notification/services/notification.service";
import { notifyApprovalCreatedInApp } from "../../../shared/utils/notify-approval-created.util";
import { WorkspaceBriefService } from "./workspace-brief.service";
import { ThreadService } from "./thread.service";

/**
 * Ops tools live on the supervisor path (blogs.list / get / statistics / publish), not v0.5 skills.
 * Includes schedule/publish/unpublish/delete plus list/get/analytics.
 *
 * Not included (stay on v0.5):
 * - `strategy` → content_strategy skill (doc 21/22)
 * - `create_campaign` / `learn_campaign` → Conversation collect on v0.5 (campaigns.create tool available)
 */
/**
 * Ops intents that use the supervisor tool path (blogs.list/get/publish/schedule/…).
 * Strategy / campaign create-collect / knowledge stay on v0.5 skills + strategy.* / campaigns.* tools.
 * Doc 22: conversational ops for publish/schedule/list; strategist path for strategy.
 */
const SUPERVISOR_OPS_INTENTS = new Set([
  "list_content",
  "get_content",
  "analytics",
  "publish_content",
  "schedule_content",
  "unpublish_content",
  "delete_content",
  "update_campaign",
  "campaign_performance",
]);

interface ChatAttachment {
  name: string;
  url: string;
  mime_type: string;
  extracted_text?: string;
}

interface BaseTurnInput {
  siteId: string;
  userId: string;
  message: string;
  threadId?: string;
  requestId?: string;
  sessionMode?: ClientSessionMode;
  selectionContext?: {
    blog_id: string;
    reference_type?: "highlight" | "blog";
    text?: string;
  };
  attachments?: ChatAttachment[];
  conversationMode?: boolean;
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
    private readonly tokenEnforcement: TokenEnforcementService,
    private readonly campaignRoadmapService: CampaignRoadmapService,
    private readonly contextPackBuilder: ContextPackBuilderService,
    private readonly memoryExtraction: MemoryExtractionService,
    private readonly sessionModeRouter: SessionModeRouterService,
    private readonly v05Graph: OrchestratorV05GraphService,
    private readonly conversationIntelligence: ConversationIntelligenceService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationService: NotificationService,
    private readonly onboardingService: OnboardingService,
    private readonly websiteIngest: WebsiteIngestService,
    private readonly workspaceBrief: WorkspaceBriefService,
    private readonly threadService: ThreadService
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
  async onboardingChat(input: Omit<BaseTurnInput, "threadId">): Promise<ChatTurnResponse> {
    return this.runTurn({ ...input, mode: "onboarding" });
  }

  /**
   * Start (or resume) the brand-setup interview without an LLM call: append the
   * next question (website gate, proposal confirm, or field interview) on the
   * canonical onboarding thread. Idempotent when that question is already unanswered.
   */
  async startOnboardingInterview(
    siteId: string,
    userId: string
  ): Promise<{
    complete: boolean;
    thread_id?: string;
    assistant_message?: { id: string; content: string; created_at: Date };
    progress: SetupProgress;
  }> {
    await this.assertSiteAccess(siteId, userId);
    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    const progress = await this.onboardingService.getSetupProgress(userId, siteId);

    if (progress.complete) {
      const existing = await this.threadRepository.findOnboardingThread(siteId, userId);
      if (existing?._id) {
        await this.threadRepository.markOnboardingComplete(existing._id.toString(), siteId);
      }
      return { complete: true, progress };
    }

    const thread = await this.resolveThread(siteId, userId, undefined, "onboarding");
    const threadId = thread._id!.toString();
    const history = await this.messageRepository.listByThread(threadId, siteId);
    const question = buildNextOnboardingQuestion(memory, history);

    if (!question) {
      return { complete: true, progress, thread_id: threadId };
    }

    const last = history[history.length - 1];
    if (last?.role === OrchestratorMessageRole.ASSISTANT && last.content.includes(question)) {
      return {
        complete: false,
        thread_id: threadId,
        assistant_message: {
          id: last._id!.toString(),
          content: last.content,
          created_at: last.created_at ?? new Date(),
        },
        progress,
      };
    }

    const path = memory.onboarding_path ?? "unset";
    const opener =
      history.length === 0
        ? path === "unset"
          ? "Let's set up your workspace. Sharing a website is the fastest path — or we can chat through a few questions."
          : "Let's finish your workspace setup. I'll ask one thing at a time."
        : "Let's pick up where we left off on your workspace setup.";
    const content = `${opener}\n\n${question}`;

    const assistant = await this.messageRepository.create({
      thread_id: threadId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content,
    });

    return {
      complete: false,
      thread_id: threadId,
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at ?? new Date(),
      },
      progress,
    };
  }

  async listThreads(siteId: string, userId: string, limit = 50): Promise<OrchestratorThread[]> {
    const { threads } = await this.threadService.list(siteId, userId, { limit });
    return threads;
  }

  async getThreadWithMessages(
    threadId: string,
    siteId: string,
    userId: string
  ): Promise<{ thread: OrchestratorThread; messages: OrchestratorMessage[] }> {
    const { thread, messages } = await this.threadService.getWithMessages(threadId, siteId, userId);
    return { thread, messages };
  }

  async renameThread(threadId: string, siteId: string, userId: string, title: string): Promise<OrchestratorThread> {
    return this.threadService.rename(threadId, siteId, userId, title);
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
    note?: string,
    destinations?: string[]
  ): Promise<OrchestratorApproval> {
    await this.assertSiteAccess(siteId, userId);
    let decided = await this.approvalRepository.decide(
      approvalId,
      siteId,
      decision === "approved" ? OrchestratorApprovalStatus.APPROVED : OrchestratorApprovalStatus.REJECTED,
      userId,
      note
    );
    if (!decided) {
      throw new NotFoundError("Approval not found or already decided");
    }
    if (
      decision === "approved" &&
      destinations?.length &&
      (decided.action === "blogs_publish" || decided.action === "blogs_schedule")
    ) {
      const { normalizeDestinations } = await import("../../integrations/idempotency");
      const { PublishDestinationOverride } = await import("../../integrations/services/destination-override");
      const { container } = await import("tsyringe");
      const normalized = normalizeDestinations(destinations);
      const merged = await this.approvalRepository.mergePayload(approvalId, siteId, { destinations: normalized });
      if (merged) decided = merged;
      const blogId = typeof decided.payload?.id === "string" ? decided.payload.id : undefined;
      if (blogId) {
        container.resolve(PublishDestinationOverride).set(siteId, blogId, normalized);
      }
    }
    this.realtimeService.emitToUser(
      decided.requested_for_user_id,
      REALTIME_EVENTS.APPROVAL_DECIDED,
      {
        id: decided._id!.toString(),
        siteId,
        status: decided.status,
        kind: decided.kind,
        action: decided.action,
      },
      { siteId }
    );
    if (
      decided.action === "strategy_update" ||
      decided.action === "campaign_create" ||
      decided.action === "campaign_update" ||
      decided.action === "campaign_schedule_additional_posts" ||
      decided.action === "writing_request_research" ||
      decided.action === "blogs_publish" ||
      decided.action === "blogs_unpublish" ||
      decided.action === "blogs_schedule" ||
      decided.action === "blogs_unschedule"
    ) {
      // orchestratorv2 HITL: resume LangGraph on the same thread_id
      const { default: OrchestratorV2Service } = await import("../../orchestratorv2/orchestrator.service");
      const { container } = await import("tsyringe");
      const v2 = container.resolve(OrchestratorV2Service);
      await v2.resumeHitlApproval(decided, decision, note);
    } else if (decision === "approved") {
      await this.executeApprovedAction(decided, userId);
    }
    return decided;
  }

  // ---------------------------------------------------------------------------
  // Core turn loop
  // ---------------------------------------------------------------------------

  private async runTurn(input: BaseTurnInput & { mode: "active" | "onboarding" }): Promise<ChatTurnResponse> {
    const { siteId, userId, message, mode } = input;
    await this.assertSiteAccess(siteId, userId);

    const memory = await this.memoryRepository.ensureForSite(siteId, userId);

    const modeResolution: SessionModeResolution | null =
      mode === "active"
        ? this.sessionModeRouter.resolve({
            clientMode: input.sessionMode,
            userMessage: message,
            hasSelectionContext: !!input.selectionContext,
          })
        : null;

    const effectiveSessionMode: OperationalSessionMode = modeResolution?.effectiveMode ?? "planning";

    const contextPack =
      mode === "active"
        ? await this.contextPackBuilder.build({
            siteId,
            memory,
            userMessage: message,
            sessionMode: effectiveSessionMode,
          })
        : null;

    const enrichedMessage = buildEnrichedUserMessage({
      message,
      sessionMode: effectiveSessionMode,
      selectionContext: input.selectionContext,
      attachments: input.attachments,
      contextPackBlock: contextPack ? this.contextPackBuilder.toPromptBlock(contextPack) : undefined,
    });

    const site = await this.siteService.getSiteById(siteId, userId);
    const memberRole = await this.siteService.getUserRole(siteId, userId);
    // Chatless signup: promote legacy onboarding sites so normal chat works.
    if (mode === "active" && site.status === SiteStatus.ONBOARDING) {
      await this.siteService.markSiteActive(siteId, userId);
    }

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
    const pendingApproval = await this.approvalRepository.findPendingForThread(thread._id!.toString(), siteId);
    if (pendingApproval && this.shortCircuitConfirmationReply(message, pendingApproval)) {
      return this.resolveConfirmationFromText(siteId, userId, thread, pendingApproval, message);
    }

    // Website-first onboarding / context-refresh branches (deterministic; no LLM).
    if (mode === "onboarding") {
      const gated = await this.tryWebsiteOnboardingTurn({
        siteId,
        userId,
        message,
        thread,
        memory,
      });
      if (gated) return gated;
    } else if (mode === "active") {
      const refresh = await this.tryWebsiteContextRefreshTurn({
        siteId,
        userId,
        message,
        thread,
        memory,
        effectiveSessionMode,
        modeResolution,
      });
      if (refresh) return refresh;
    }

    // M5: v0.5 LangGraph is the default active chat brain (opt out with ORCHESTRATOR_V05_GRAPH_ENABLED=false).
    // List/get/stats (and publish ops) still need the supervisor tool surface.
    if (env.orchestrator.v05GraphEnabled && mode === "active") {
      const recentForPeek = history.slice(-16).map((m) => ({
        role: (m.role === OrchestratorMessageRole.ASSISTANT ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));
      const peekCi = await this.conversationIntelligence.analyze({
        message,
        recent_messages: recentForPeek,
        workspace_id: siteId,
        user_id: userId,
        thread_id: thread._id!.toString(),
        conversation_mode: input.conversationMode,
        open_artifacts: input.selectionContext?.blog_id ? { draft_id: input.selectionContext.blog_id } : undefined,
      });
      const useSupervisorOps = SUPERVISOR_OPS_INTENTS.has(peekCi.workflow_intent);
      if (!useSupervisorOps) {
        return this.runV05GraphTurn({
          siteId,
          userId,
          message,
          thread,
          history,
          effectiveSessionMode,
          modeResolution,
          conversationMode: input.conversationMode,
          conversationContext: peekCi,
          selectionContext: input.selectionContext,
        });
      }
    }

    // Supervisor path: onboarding always; active only when v0.5 explicitly disabled.
    // Cognition dual-brain removed in M5 (ADR-014).

    const llmMessage = enrichedMessage;

    const feature =
      mode === "onboarding" ? TokenLedgerFeature.ORCHESTRATOR_ONBOARDING : TokenLedgerFeature.ORCHESTRATOR_CHAT;

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
        promptText: llmMessage,
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
          memberRole,
          threadId: thread._id!.toString(),
          workspaceName: site.name,
          workspaceId: siteId,
          mode,
          memory,
          history,
          newUserMessage: message,
          enrichedUserMessage: llmMessage,
          sessionMode: effectiveSessionMode,
          clientSessionMode: input.sessionMode ?? "auto",
          selectionContext: input.selectionContext,
          conversationMode: input.conversationMode,
        });

        const historyForApply = await this.messageRepository.listByThread(thread._id!.toString(), siteId, {
          limit: env.orchestrator.maxThreadMessages,
        });
        return this.applyPlan(
          siteId,
          userId,
          thread,
          plan,
          mode,
          memory,
          historyForApply,
          message,
          modeResolution,
          input.selectionContext,
          input.conversationMode
        );
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
    threadHistory?: OrchestratorMessage[],
    userMessage?: string,
    modeResolution?: SessionModeResolution | null,
    selectionContext?: SelectionContextPayload,
    conversationMode?: boolean
  ): Promise<ChatTurnResponse> {
    const rawNext = plan.decision.next;
    let decision = plan.decision;
    let assistantReply = plan.assistant_reply;
    let pendingApproval: OrchestratorApproval | null = null;
    let onboardingCompleted = false;
    let workspaceStatus: "onboarding" | "active" = mode === "onboarding" ? "onboarding" : "active";

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

    if (plan.prior_tool_invocation) {
      await this.messageRepository.create({
        thread_id: thread._id!.toString(),
        site_id: siteId,
        role: OrchestratorMessageRole.TOOL,
        content: plan.prior_tool_invocation.summary,
        tool_name: plan.prior_tool_invocation.name,
      });
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
      this.emitApprovalCreated(pendingApproval);
      if (!assistantReply) {
        assistantReply = decision.confirmation.summary;
      }
    }

    const hasMemoryPatch = !!decision.memory_patch && Object.keys(decision.memory_patch).length > 0;
    const effectiveMode = modeResolution?.effectiveMode;
    if (
      hasMemoryPatch &&
      (rawNext === "update_memory" ||
        (mode === "onboarding" && decision.next !== "complete_onboarding") ||
        (mode === "active" && effectiveMode === "casual" && decision.next === "respond"))
    ) {
      await this.memoryRepository.update(siteId, decision.memory_patch as never, userId);
    }

    if (mode === "onboarding" && decision.next !== "complete_onboarding" && workspaceMemory) {
      const memoryAfterPatch = (await this.memoryRepository.findBySiteId(siteId)) ?? workspaceMemory;
      const repaired = ensureOnboardingInterviewReply(assistantReply, memoryAfterPatch, threadHistory);
      if (repaired.repaired) {
        assistantReply = repaired.reply;
        decision = { ...decision, next: "respond", reply: assistantReply };
      }
    }

    if (mode === "active" && decision.next === "respond" && workspaceMemory) {
      const hasSelectionFocus = !!selectionContext;
      if (hasSelectionFocus) {
        const repaired = ensureConversationContinuation(assistantReply, {
          hasSelectionFocus: true,
          selectionSnippet: selectionContext?.text,
          memory: workspaceMemory,
        });
        if (repaired.repaired) {
          assistantReply = repaired.reply;
          decision = { ...decision, reply: assistantReply };
        }
      } else if (effectiveMode === "casual") {
        const repaired = ensureCasualConversationReply(assistantReply, workspaceMemory);
        if (repaired.repaired) {
          assistantReply = repaired.reply;
          decision = { ...decision, reply: assistantReply };
        }
      }
    }

    if (mode === "active" && conversationMode && workspaceMemory) {
      const voiceRepaired = ensureVoiceConversationReply(assistantReply, {
        memory: workspaceMemory,
        userMessage,
      });
      assistantReply = voiceRepaired.reply;
      if (decision.next === "respond") {
        decision = { ...decision, reply: assistantReply };
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

    if (mode === "active" && userMessage) {
      void this.memoryExtraction.processTurn({
        siteId,
        userId,
        threadId: thread._id!.toString(),
        userMessage,
        assistantReply: assistantReply || "",
        sessionMode: effectiveMode,
      });
    }

    if (mode === "active") {
      void this.maybeAutoTitleThread(siteId, thread._id!.toString());
    }

    return {
      thread_id: thread._id!.toString(),
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at,
      },
      tool_calls: plan.tool_invocation
        ? [
            {
              tool: plan.tool_invocation.name,
              summary: plan.tool_invocation.summary,
              output_data: plan.tool_invocation.data,
            },
          ]
        : [],
      pending_approval: pendingApproval ? serializeApproval(pendingApproval) : null,
      active_session_mode: effectiveMode ?? "planning",
      session_mode_source: modeResolution?.source,
      workspace_status: workspaceStatus,
      onboarding_completed: onboardingCompleted,
    };
  }

  // ---------------------------------------------------------------------------
  // Confirmation resolution (in-chat yes/no shortcut)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // v0.5 LangGraph path
  // ---------------------------------------------------------------------------

  /**
   * Feature-flagged v0.5 path — Conversation Intelligence → LangGraph skills.
   * Active-mode v0.5 turn (M5 default). Supervisor remains for onboarding and
   * when ORCHESTRATOR_V05_GRAPH_ENABLED=false.
   */
  private async runV05GraphTurn(input: {
    siteId: string;
    userId: string;
    message: string;
    thread: OrchestratorThread;
    history: OrchestratorMessage[];
    effectiveSessionMode: OperationalSessionMode;
    modeResolution: SessionModeResolution | null;
    conversationMode?: boolean;
    conversationContext?: ConversationContext;
    selectionContext?: SelectionContextPayload;
  }): Promise<ChatTurnResponse> {
    const {
      siteId,
      userId,
      message,
      thread,
      history,
      effectiveSessionMode,
      modeResolution,
      conversationMode,
      conversationContext,
      selectionContext,
    } = input;
    const threadId = thread._id!.toString();

    await this.messageRepository.create({
      thread_id: threadId,
      site_id: siteId,
      role: OrchestratorMessageRole.USER,
      content: message,
    });

    const recent_messages = history.slice(-16).map((m) => ({
      role: (m.role === OrchestratorMessageRole.ASSISTANT ? "assistant" : "user") as "user" | "assistant",
      content: m.content,
    }));

    this.realtimeService.emitToUser(
      userId,
      REALTIME_EVENTS.ORCHESTRATOR_TURN_STARTED,
      { threadId, siteId },
      { siteId }
    );

    let lastPhaseEmitAt = 0;
    const onPhase = (event: WorkflowPhaseEvent) => {
      const now = Date.now();
      // Coalesce high-frequency percent updates (~150ms).
      if (typeof event.percent === "number" && now - lastPhaseEmitAt < 150) {
        return;
      }
      lastPhaseEmitAt = now;
      this.realtimeService.emitToUser(
        userId,
        REALTIME_EVENTS.ORCHESTRATOR_PHASE,
        {
          threadId,
          siteId,
          phase: event.phase,
          message: event.message,
          percent: event.percent,
          skill_id: event.skill_id,
        },
        { siteId }
      );
    };

    // WorkspaceBrief for every turn (doc 22 § isolation + awareness); voice adds product-steer prefix.
    let workspaceBriefBlock: string | undefined;
    try {
      const brief = await this.workspaceBrief.buildBrief(siteId, userId);
      workspaceBriefBlock = conversationMode
        ? `Product steer (voice): priority=${brief.priority}. ${brief.opener_line}\nWorkspace brief:\n${brief.text}`
        : `Workspace brief (site-shared knowledge; do not invent other threads' chats):\n${brief.text}`;
    } catch {
      workspaceBriefBlock = undefined;
    }

    const result = await this.v05Graph.runTurn({
      workspace_id: siteId,
      user_id: userId,
      thread_id: threadId,
      message,
      recent_messages,
      history_messages: history.map((m) => ({
        role: m.role,
        tool_calls: m.tool_calls?.map((t) => ({
          tool: t.tool,
          output_data: (t.output_data ?? undefined) as Record<string, unknown> | undefined,
        })),
      })),
      conversation_mode: conversationMode,
      conversation_context: conversationContext,
      voice_product_steer: workspaceBriefBlock,
      selection: selectionContext?.blog_id
        ? {
            blog_id: selectionContext.blog_id,
            reference_type: selectionContext.reference_type,
            text: selectionContext.text,
          }
        : undefined,
      onPhase,
    });

    let reply = result.reply;
    if (conversationMode) {
      const memory = await this.memoryRepository.findBySiteId(siteId);
      const voiceRepaired = ensureVoiceConversationReply(reply, {
        memory: memory ?? undefined,
        userMessage: message,
      });
      reply = voiceRepaired.reply;
    }

    const assistant = await this.messageRepository.create({
      thread_id: threadId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: reply,
      tool_calls: result.tool_calls.map((t) => ({
        tool: t.tool,
        input: {},
        summary: t.summary,
        output_data: t.output_data,
      })),
    });

    logger.info(
      "Orchestrator v0.5 graph turn completed",
      {
        component: "orchestrator",
        event: "v05_graph_turn",
        siteId,
        threadId,
        skillsRun: result.state.skills_run_this_turn,
        stage: result.state.workflow_stage,
      },
      "OrchestratorService"
    );

    this.realtimeService.emitToUser(
      userId,
      REALTIME_EVENTS.ORCHESTRATOR_TURN_COMPLETED,
      {
        threadId,
        siteId,
        workflow_stage: result.state.workflow_stage,
        skills_run: result.state.skills_run_this_turn,
      },
      { siteId }
    );

    void this.maybeAutoTitleThread(siteId, threadId);

    return {
      thread_id: threadId,
      assistant_message: {
        id: assistant._id!.toString(),
        content: reply,
        created_at: assistant.created_at ?? new Date(),
      },
      tool_calls: result.tool_calls,
      pending_approval: null,
      active_session_mode: effectiveSessionMode,
      session_mode_source: modeResolution?.source,
      workspace_status: "active",
      onboarding_completed: false,
      v05_graph: {
        enabled: true,
        workflow_stage: result.state.workflow_stage,
        skills_run: result.state.skills_run_this_turn,
        mode: result.state.mode,
        phases: [...result.phases],
        ...buildV05MoatSnapshot(result.state, result.phases),
      },
    };
  }

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
      reply = exec.ok ? `Done. ${exec.summary}` : `I couldn't complete '${decided.action}': ${exec.summary}`;
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
      active_session_mode: "planning",
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

      const memberRole = await this.siteService.getUserRole(approval.site_id, userId);
      if (!canRunOrchestratorTool(memberRole, tool.name, tool.requiresConfirmation)) {
        const summary =
          "Your workspace role doesn't allow that action. Ask a workspace admin to perform permanent changes.";
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

    if (approval.kind === OrchestratorApprovalKind.CAMPAIGN_ROADMAP_APPROVAL) {
      const campaignId = String(approval.payload?.campaign_id ?? "");
      if (!campaignId) {
        const summary = "Campaign roadmap approval is missing campaign_id.";
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: false,
          error: summary,
        });
        return { ok: false, summary };
      }
      try {
        const data = await this.campaignRoadmapService.approveRoadmap(campaignId, approval.site_id, userId);
        const summary = "Campaign roadmap approved and schedule materialized.";
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: true,
          summary,
          data,
        });
        return { ok: true, summary, data };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
          ok: false,
          error: msg,
        });
        return { ok: false, summary: msg };
      }
    }

    if (approval.kind === OrchestratorApprovalKind.CAMPAIGN_PROPOSAL) {
      const summary = `Campaign proposal recorded (${approval.action}).`;
      await this.approvalRepository.markExecuted(approval._id!.toString(), approval.site_id, {
        ok: true,
        summary,
      });
      return { ok: true, summary };
    }

    // Scheduled-post review approvals are executed via the review service / UI.
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
   * at the TOP level of the payload (e.g. `business_description`, `business_goals`,
   * `customers`, ...). We map those into the persisted
   * `WorkspaceMemory.strategic` / `.preferences` shape.
   *
   * Nested forms (`payload.strategic`, `payload.preferences`,
   * `payload.operational`) are still accepted so future prompt revisions don't
   * silently drop context.
   */
  private buildMemoryPatchFromOnboardingPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    const strategic: Record<string, unknown> = {};
    const preferences: Record<string, unknown> = {};
    const operational: Record<string, unknown> = {};

    const STRATEGIC_KEYS = [
      "website_url",
      "industries",
      "business_model",
      "business_description",
      "business_type",
      "brand_voice",
      "brand_negatives",
      "target_audience",
      "customers",
      "competitors",
      "business_goals",
      "seo_priorities",
      "publishing_channels",
      "competitive_notes",
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
    if (payload.preferences && typeof payload.preferences === "object" && !Array.isArray(payload.preferences)) {
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
    if (payload.operational && typeof payload.operational === "object" && !Array.isArray(payload.operational)) {
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
      return found;
    }
    return this.threadService.create({ siteId, userId });
  }

  /**
   * Persisted message cap: drop oldest rows so Mongo stays bounded even when
   * the supervisor loads only the latest N in memory.
   */
  private async pruneOrchestratorThread(threadId: string, siteId: string): Promise<number> {
    const n = await this.messageRepository.pruneThreadToMaxKeep(threadId, siteId, env.orchestrator.maxThreadMessages);
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

  private emitApprovalCreated(approval: OrchestratorApproval): void {
    const siteId = approval.site_id;
    this.realtimeService.emitToUser(
      approval.requested_for_user_id,
      REALTIME_EVENTS.APPROVAL_CREATED,
      {
        id: approval._id!.toString(),
        siteId,
        kind: approval.kind,
        action: approval.action,
        summary: approval.summary,
        threadId: approval.thread_id,
      },
      { siteId }
    );
    void notifyApprovalCreatedInApp(this.notificationService, approval);
  }

  private async assertSiteAccess(siteId: string, userId: string): Promise<void> {
    const has = await this.siteService.hasSiteAccess(siteId, userId);
    if (!has) {
      throw new ForbiddenError("You do not have access to this workspace");
    }
  }

  /**
   * Deterministic website-first onboarding turns: URL ingest → propose → confirm,
   * or decline → secondary field interview. Returns null to fall through to LLM.
   */
  private async tryWebsiteOnboardingTurn(args: {
    siteId: string;
    userId: string;
    message: string;
    thread: OrchestratorThread;
    memory: WorkspaceMemory;
  }): Promise<ChatTurnResponse | null> {
    const { siteId, userId, message, thread, memory } = args;
    const path = memory.onboarding_path ?? "unset";
    const threadId = thread._id!.toString();

    if (path === "unset") {
      const url = extractWebsiteUrl(message);
      if (url) {
        await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.USER,
          content: message,
        });
        const proposed = await this.websiteIngest.ingestAndPropose(url);
        if (!proposed) {
          await this.memoryRepository.update(
            siteId,
            { onboarding_path: "secondary", pending_proposal: null } as never,
            userId
          );
          const updated = (await this.memoryRepository.findBySiteId(siteId)) ?? memory;
          const nextQ = buildNextOnboardingQuestion({ ...updated, onboarding_path: "secondary" }, undefined);
          const reply = `I couldn't read that website. Let's set things up via chat instead.\n\n${nextQ ?? "What does your business do, in one sentence?"}`;
          const assistant = await this.messageRepository.create({
            thread_id: threadId,
            site_id: siteId,
            role: OrchestratorMessageRole.ASSISTANT,
            content: reply,
          });
          await this.threadRepository.touch(threadId);
          return this.buildSimpleResponse(thread, assistant, "onboarding");
        }

        await this.memoryRepository.update(
          siteId,
          {
            onboarding_path: "primary",
            pending_proposal: proposed.proposal,
            context_refresh_active: false,
            strategic: {
              ...(memory.strategic as object),
              website_url: proposed.url,
            },
          } as never,
          userId
        );
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: proposed.summary,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "onboarding");
      }

      if (isNoWebsiteReply(message)) {
        await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.USER,
          content: message,
        });
        await this.memoryRepository.update(
          siteId,
          { onboarding_path: "secondary", pending_proposal: null } as never,
          userId
        );
        const nextQ = buildNextOnboardingQuestion(
          { ...memory, onboarding_path: "secondary", pending_proposal: null },
          undefined
        );
        const reply = `No problem — we'll set up your workspace through a short chat.\n\n${nextQ ?? "What does your business do, in one sentence?"}`;
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: reply,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "onboarding");
      }

      // Ambiguous reply while awaiting a URL — re-ask without LLM.
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });
      const reply = `Please paste a website URL, or say you don't have one.\n\n${WEBSITE_ONBOARDING_QUESTION}`;
      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: reply,
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "onboarding");
    }

    if (path === "primary" && memory.pending_proposal) {
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });

      if (isAffirmativeReply(message)) {
        const applied = await this.applyWebsiteProposalAndComplete({
          siteId,
          userId,
          thread,
          memory,
          contextRefreshOnly: false,
        });
        return applied;
      }

      if (isRejectReply(message)) {
        await this.memoryRepository.update(
          siteId,
          { onboarding_path: "secondary", pending_proposal: null } as never,
          userId
        );
        const nextQ = buildNextOnboardingQuestion(
          { ...memory, onboarding_path: "secondary", pending_proposal: null },
          undefined
        );
        const reply = `Understood — we'll capture your workspace details via chat instead.\n\n${nextQ ?? "What does your business do, in one sentence?"}`;
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: reply,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "onboarding");
      }

      const reply = "Please reply yes to apply the proposed profile, or no to set things up via chat instead.";
      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: reply,
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "onboarding");
    }

    return null;
  }

  /**
   * Active-mode business-context refresh via the same website primary/secondary fork.
   */
  private async tryWebsiteContextRefreshTurn(args: {
    siteId: string;
    userId: string;
    message: string;
    thread: OrchestratorThread;
    memory: WorkspaceMemory;
    effectiveSessionMode: OperationalSessionMode;
    modeResolution: SessionModeResolution | null;
  }): Promise<ChatTurnResponse | null> {
    const { siteId, userId, message, thread, memory, effectiveSessionMode } = args;
    const threadId = thread._id!.toString();

    // Confirm / reject a staged refresh proposal.
    if (memory.context_refresh_active && memory.pending_proposal) {
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });

      if (isAffirmativeReply(message)) {
        return this.applyWebsiteProposalAndComplete({
          siteId,
          userId,
          thread,
          memory,
          contextRefreshOnly: true,
          activeSessionMode: effectiveSessionMode,
        });
      }

      if (isRejectReply(message) || isNoWebsiteReply(message)) {
        await this.memoryRepository.update(
          siteId,
          { pending_proposal: null, context_refresh_active: false } as never,
          userId
        );
        const reply = isRejectReply(message)
          ? "Okay — I won't apply that website profile. Tell me what you'd like to change about your business context."
          : "Okay — tell me what to update about your business context (audience, voice, goals, etc.).";
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: reply,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
      }

      const url = extractWebsiteUrl(message);
      if (url) {
        const proposed = await this.websiteIngest.ingestAndPropose(url);
        if (!proposed) {
          const assistant = await this.messageRepository.create({
            thread_id: threadId,
            site_id: siteId,
            role: OrchestratorMessageRole.ASSISTANT,
            content:
              "I couldn't read that website. Paste another URL, or say you don't have one and we'll update via chat.",
          });
          await this.threadRepository.touch(threadId);
          return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
        }
        await this.memoryRepository.update(
          siteId,
          {
            pending_proposal: proposed.proposal,
            context_refresh_active: true,
            strategic: {
              ...(memory.strategic as object),
              website_url: proposed.url,
            },
          } as never,
          userId
        );
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: proposed.summary,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
      }

      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: "Reply yes to apply the proposed profile, no to discard it, or paste a different website URL.",
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
    }

    // Awaiting URL after we already asked for a refresh (context_refresh_active, no proposal yet).
    if (memory.context_refresh_active && !memory.pending_proposal) {
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });

      if (isNoWebsiteReply(message)) {
        await this.memoryRepository.update(siteId, { context_refresh_active: false } as never, userId);
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content:
            "Got it. Tell me what to update — for example audience, brand voice, goals, or tone — and I'll patch your workspace memory.",
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
      }

      const url = extractWebsiteUrl(message);
      if (url) {
        const proposed = await this.websiteIngest.ingestAndPropose(url);
        if (!proposed) {
          const assistant = await this.messageRepository.create({
            thread_id: threadId,
            site_id: siteId,
            role: OrchestratorMessageRole.ASSISTANT,
            content:
              "I couldn't read that website. Paste another URL, or say you don't have one and we'll update via chat.",
          });
          await this.threadRepository.touch(threadId);
          return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
        }
        await this.memoryRepository.update(
          siteId,
          {
            pending_proposal: proposed.proposal,
            context_refresh_active: true,
            strategic: {
              ...(memory.strategic as object),
              website_url: proposed.url,
            },
          } as never,
          userId
        );
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: proposed.summary,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
      }

      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: `Please paste a website URL, or say you don't have one.\n\n${WEBSITE_ONBOARDING_QUESTION}`,
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
    }

    // Fresh intent to update business/brand context.
    if (isBusinessContextRefreshIntent(message)) {
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });

      const url = extractWebsiteUrl(message);
      if (url) {
        const proposed = await this.websiteIngest.ingestAndPropose(url);
        if (!proposed) {
          await this.memoryRepository.update(siteId, { context_refresh_active: true } as never, userId);
          const assistant = await this.messageRepository.create({
            thread_id: threadId,
            site_id: siteId,
            role: OrchestratorMessageRole.ASSISTANT,
            content:
              "I couldn't read that website. Paste another URL, or say you don't have one and we'll update via chat.",
          });
          await this.threadRepository.touch(threadId);
          return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
        }
        await this.memoryRepository.update(
          siteId,
          {
            pending_proposal: proposed.proposal,
            context_refresh_active: true,
            strategic: {
              ...(memory.strategic as object),
              website_url: proposed.url,
            },
          } as never,
          userId
        );
        const assistant = await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: proposed.summary,
        });
        await this.threadRepository.touch(threadId);
        return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
      }

      await this.memoryRepository.update(siteId, { context_refresh_active: true } as never, userId);
      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: `I can refresh your business context from a website, or we can update it in chat.\n\n${WEBSITE_ONBOARDING_QUESTION}`,
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "active", effectiveSessionMode);
    }

    return null;
  }

  private async applyWebsiteProposalAndComplete(args: {
    siteId: string;
    userId: string;
    thread: OrchestratorThread;
    memory: WorkspaceMemory;
    contextRefreshOnly: boolean;
    activeSessionMode?: OperationalSessionMode;
  }): Promise<ChatTurnResponse> {
    const { siteId, userId, thread, memory, contextRefreshOnly } = args;
    const threadId = thread._id!.toString();
    const proposal = memory.pending_proposal;
    if (!proposal) {
      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: "There's no pending website profile to apply. Share a URL or continue in chat.",
      });
      return this.buildSimpleResponse(
        thread,
        assistant,
        contextRefreshOnly ? "active" : "onboarding",
        args.activeSessionMode
      );
    }

    const websiteUrl = memory.strategic.website_url;
    const basePatch = proposalToMemoryPatch(proposal, websiteUrl);
    const strategic = {
      ...(memory.strategic as object),
      ...((basePatch.strategic as object) || {}),
    } as Record<string, unknown>;
    const preferences = {
      ...(memory.preferences as object),
      ...((basePatch.preferences as object) || {}),
    } as Record<string, unknown>;

    if (contextRefreshOnly) {
      await this.memoryRepository.update(
        siteId,
        {
          strategic,
          preferences,
          ...(typeof basePatch.memory_summary === "string" ? { memory_summary: basePatch.memory_summary } : {}),
          pending_proposal: null,
          context_refresh_active: false,
        } as never,
        userId
      );
      const assistant = await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: "Applied. Your workspace business context is updated from the website profile.",
      });
      await this.threadRepository.touch(threadId);
      return this.buildSimpleResponse(thread, assistant, "active", args.activeSessionMode);
    }

    // Ensure completeOnboarding required fields exist.
    const businessDescription =
      (typeof strategic.business_description === "string" && strategic.business_description.trim()) ||
      (typeof strategic.business_type === "string" && strategic.business_type.trim()) ||
      "Business (from website)";
    const audience = Array.isArray(strategic.target_audience)
      ? (strategic.target_audience as string[]).filter((s) => typeof s === "string" && s.trim())
      : [];
    const customers = Array.isArray(strategic.customers)
      ? (strategic.customers as Array<{ who?: string; pain_points?: string; success?: string; label?: string }>)
          .filter((c) => c && typeof c.who === "string" && c.who.trim())
          .map((c) => ({
            who: c.who!.trim(),
            pain_points: c.pain_points,
            success: c.success,
            label: c.label,
          }))
      : [];
    const seededCustomers =
      customers.length > 0
        ? customers
        : audience.length
          ? audience.map((label) => ({ who: label, label }))
          : [{ who: "General audience", label: "General audience" }];
    const brandVoice =
      (typeof strategic.brand_voice === "string" && strategic.brand_voice.trim()) ||
      (typeof preferences.tone === "string" && preferences.tone.trim()) ||
      "Clear, helpful, and credible.";
    const goals = Array.isArray(strategic.business_goals)
      ? (strategic.business_goals as string[]).filter((s) => typeof s === "string" && s.trim())
      : [];
    const competitors = Array.isArray(strategic.competitors)
      ? (strategic.competitors as Array<{ name?: string; notes?: string }>)
          .filter((c) => c && typeof c.name === "string" && c.name.trim())
          .map((c) => ({ name: c.name!.trim(), notes: c.notes }))
      : undefined;

    const completeInput = {
      strategic: {
        business_description: businessDescription,
        industries: Array.isArray(strategic.industries) ? strategic.industries : undefined,
        business_model: typeof strategic.business_model === "string" ? strategic.business_model : undefined,
        target_audience: audience.length ? audience : seededCustomers.map((c) => c.label || c.who),
        customers: seededCustomers,
        brand_voice: brandVoice,
        brand_negatives: typeof strategic.brand_negatives === "string" ? strategic.brand_negatives : undefined,
        business_goals: goals.length ? goals : ["Grow audience through content"],
        seo_priorities: Array.isArray(strategic.seo_priorities) ? strategic.seo_priorities : [],
        publishing_channels: Array.isArray(strategic.publishing_channels) ? strategic.publishing_channels : [],
        competitors,
        website_url: websiteUrl,
      },
      preferences: {
        tone: typeof preferences.tone === "string" ? preferences.tone : undefined,
        default_word_count:
          typeof preferences.default_word_count === "number" ? preferences.default_word_count : undefined,
      },
      memory_summary:
        typeof basePatch.memory_summary === "string"
          ? basePatch.memory_summary
          : `Business: ${businessDescription}. Website: ${websiteUrl ?? "n/a"}.`,
    };

    const tool = this.toolRegistry.get("workspace.completeOnboarding");
    let toolSummary = "Workspace onboarding completed.";
    if (tool) {
      const result = await tool.run({
        siteId,
        userId,
        threadId,
        input: completeInput,
      });
      toolSummary = result.summary;
      await this.messageRepository.create({
        thread_id: threadId,
        site_id: siteId,
        role: OrchestratorMessageRole.TOOL,
        content: toolSummary,
        tool_name: tool.name,
      });
    } else {
      await this.memoryRepository.update(
        siteId,
        {
          strategic: completeInput.strategic,
          preferences: completeInput.preferences,
          memory_summary: completeInput.memory_summary,
        } as never,
        userId
      );
      await this.siteService.markSiteActive(siteId, userId);
    }

    await this.memoryRepository.update(
      siteId,
      {
        pending_proposal: null,
        context_refresh_active: false,
        onboarding_path: "primary",
        strategic: {
          ...completeInput.strategic,
          website_url: websiteUrl,
        },
      } as never,
      userId
    );
    await this.threadRepository.markOnboardingComplete(threadId, siteId);

    const assistant = await this.messageRepository.create({
      thread_id: threadId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: `Great — I've applied your website profile and finished workspace setup. ${toolSummary}`,
      tool_calls: tool
        ? [{ tool: tool.name, input: completeInput, output_summary: toolSummary, errored: false }]
        : undefined,
    });
    await this.threadRepository.touch(threadId);

    return {
      thread_id: threadId,
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at ?? new Date(),
      },
      tool_calls: tool ? [{ tool: tool.name, summary: toolSummary }] : [],
      pending_approval: null,
      active_session_mode: "planning",
      workspace_status: "active",
      onboarding_completed: true,
    };
  }

  /**
   * Generate a short conversation title once enough theme is clear.
   * Fire-and-forget — never blocks the chat turn.
   */
  private async maybeAutoTitleThread(siteId: string, threadId: string): Promise<void> {
    await this.threadService.maybeAutoTitle(siteId, threadId);
  }

  private buildSimpleResponse(
    thread: OrchestratorThread,
    assistant: OrchestratorMessage,
    workspaceStatus: "onboarding" | "active",
    activeSessionMode: OperationalSessionMode = "planning"
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
      active_session_mode: activeSessionMode,
      workspace_status: workspaceStatus,
      onboarding_completed: false,
    };
  }
}
