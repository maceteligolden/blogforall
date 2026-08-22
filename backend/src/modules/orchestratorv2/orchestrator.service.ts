import { singleton } from "tsyringe";
import {
  createAgent,
  PIIDetectionError,
  ToolMessage,
  type AnyAgentMiddleware,
  type HITLRequest,
  type HITLResponse,
} from "langchain";
import { Command, GraphRecursionError, MemorySaver, type Interrupt } from "@langchain/langgraph";
import {
  createLongTermMemoryMiddleware,
  createSkillMiddleware,
  createSkillHitlMiddleware,
  createSummarizationMiddleware,
  piiMiddleware,
} from "./orchestrator.middleware";
import { AGENT_MODEL } from "./orchestrator.constants";
import { mergeFocus, type ThreadFocusInput } from "./orchestrator.focus";
import { buildRoleAwareSystemPrompt } from "./prompts";
import {
  followUpAfterDraftStarted,
  formatWritingConfirmResearchDraft,
  startBoundWritingDraft,
} from "./orchestrator.writing-tools";
import { createChatOpenAI } from "../../shared/ai/create-chat-openai";
import { OrchestratorThreadRepository } from "../orchestrator/repositories/orchestrator-thread.repository";
import { OrchestratorMessageRepository } from "../orchestrator/repositories/orchestrator-message.repository";
import { OrchestratorApprovalRepository } from "../orchestrator/repositories/orchestrator-approval.repository";
import { ThreadService } from "../orchestrator/services/thread.service";
import { ThreadWriteLockService } from "../orchestrator/services/thread-write-lock.service";
import { SiteService } from "../site/services/site.service";
import { BadRequestError, ForbiddenError, NotFoundError, ThreadBusyError } from "../../shared/errors";
import { env } from "../../shared/config/env";
import { serializeApproval, type ChatTurnResponse } from "../orchestrator/interfaces/orchestrator.interface";
import type { OrchestratorThread } from "../../shared/schemas/orchestrator-thread.schema";
import { OrchestratorMessageRole } from "../../shared/schemas/orchestrator-message.schema";
import {
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
  type OrchestratorApproval,
} from "../../shared/schemas/orchestrator-approval.schema";
import type { ClientSessionMode } from "../orchestrator/utils/turn-context.helper";
import { buildEnrichedUserMessage } from "../orchestrator/utils/turn-context.helper";
import { UserRepository } from "../auth/repositories/user.repository";
import { RealtimeService, REALTIME_EVENTS } from "../../shared/realtime";
import { NotificationService } from "../notification/services/notification.service";
import { notifyApprovalCreatedInApp } from "../../shared/utils/notify-approval-created.util";
import { logger } from "../../shared/utils/logger";

export type { ThreadFocusInput };

export type OrchestratorV2ChatInput = {
  siteId: string;
  userId: string;
  message: string;
  threadId?: string;
  sessionMode?: ClientSessionMode;
  conversationMode?: boolean;
  focus?: ThreadFocusInput;
  selectionContext?: {
    blog_id: string;
    reference_type?: "highlight" | "blog";
    text?: string;
  };
  attachments?: Array<{
    name: string;
    url: string;
    mime_type: string;
    extracted_text?: string;
  }>;
};

const OPERATIONAL_MODES = new Set(["planning", "writing", "research", "review", "casual", "strategy"]);

const AGENT_INVOKE_CONFIG = { recursionLimit: 80 } as const;

/** Process-wide so chat and approval resume share the same LangGraph checkpoints. */
const v2Checkpointer = new MemorySaver();

type AgentGraphConfig = {
  configurable: { thread_id: string };
  recursionLimit?: number;
};

type AgentGraphSnapshot = {
  tasks?: Array<{ interrupts?: unknown[] }>;
  values?: { messages?: Array<Record<string, unknown>> };
};

type AgentGraph = {
  invoke: (
    input: unknown,
    config: AgentGraphConfig
  ) => Promise<Record<string, unknown> & { messages?: Array<Record<string, unknown>> }>;
  getState: (config: AgentGraphConfig) => Promise<AgentGraphSnapshot>;
  updateState: (config: AgentGraphConfig, values: unknown) => Promise<unknown>;
};

const V2_HITL_ACTIONS = new Set([
  "strategy_update",
  "campaign_create",
  "campaign_update",
  "campaign_schedule_additional_posts",
  "writing_request_research",
  "writing_confirm_research",
  "blogs_publish",
  "blogs_unpublish",
  "blogs_schedule",
  "blogs_unschedule",
]);

type HitlActionRequest = {
  name?: string;
  args?: Record<string, unknown>;
  description?: string;
};

function payloadHitlRequests(payload: Record<string, unknown> | undefined): HitlActionRequest[] {
  const hitl = payload?._hitl;
  if (!hitl || typeof hitl !== "object") return [];
  const requests = (hitl as { actionRequests?: unknown }).actionRequests;
  return Array.isArray(requests) ? (requests as HitlActionRequest[]) : [];
}

function hangingHitlRequests(
  snapshot: AgentGraphSnapshot | null,
  payload?: Record<string, unknown>
): HitlActionRequest[] {
  for (const task of snapshot?.tasks ?? []) {
    for (const item of task.interrupts ?? []) {
      const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const value =
        record.value && typeof record.value === "object" ? (record.value as Record<string, unknown>) : record;
      const requests = value.actionRequests;
      if (Array.isArray(requests) && requests.length > 0) {
        return requests as HitlActionRequest[];
      }
    }
  }
  const stored = payloadHitlRequests(payload);
  if (stored.length > 0) return stored;
  const messages = snapshot?.values?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const calls = messages[i]?.tool_calls;
    if (!Array.isArray(calls) || calls.length === 0) continue;
    const hitl = calls.filter(
      (call) =>
        call &&
        typeof call === "object" &&
        typeof (call as { name?: string }).name === "string" &&
        V2_HITL_ACTIONS.has((call as { name: string }).name)
    ) as Array<{ name: string }>;
    if (hitl.length > 0) {
      return hitl.map((call) => ({ name: call.name }));
    }
    break;
  }
  return [];
}

function primaryHitlAction(requests: HitlActionRequest[], fallback?: string): string {
  const names = requests
    .map((request) => request.name)
    .filter((name): name is string => typeof name === "string" && V2_HITL_ACTIONS.has(name));
  if (names.includes("writing_request_research")) return "writing_request_research";
  if (names.includes("writing_confirm_research")) return "writing_confirm_research";
  return names[0] || fallback || "strategy_update";
}

function hitlDecisionsForHanging(args: {
  hanging: HitlActionRequest[];
  action: string;
  decision: "approved" | "rejected";
  note?: string;
}): HITLResponse {
  const userDecision: HITLResponse["decisions"][number] =
    args.decision === "approved"
      ? { type: "approve" }
      : { type: "reject", message: hitlRejectMessage(args.action, args.note) };
  const hanging = args.hanging.length > 0 ? args.hanging : [{ name: args.action }];
  let usedPrimary = false;
  return {
    decisions: hanging.map((request) => {
      const name = typeof request.name === "string" ? request.name : args.action;
      if (name === args.action && !usedPrimary) {
        usedPrimary = true;
        return userDecision;
      }
      if (args.action === "writing_request_research" && name === "writing_confirm_research") {
        return {
          type: "reject" as const,
          message:
            "Research has not run yet. Call writing_confirm_research only after writing_request_research returns the report.",
        };
      }
      if (args.action === "writing_confirm_research" && name === "writing_request_research") {
        return {
          type: "reject" as const,
          message: "Research is already complete. Do not call writing_request_research again.",
        };
      }
      return {
        type: "reject" as const,
        message: `Only ${args.action} was reviewed. Do not call ${name} in the same turn.`,
      };
    }),
  };
}

const TOOL_NAME_TO_CLIENT: Record<string, string> = {
  campaign_list: "campaigns.list",
  campaign_get: "campaigns.get",
  campaign_create: "campaigns.create",
  campaign_update: "campaigns.update",
  campaign_generate_roadmap: "campaigns.generateRoadmap",
  campaign_get_progress: "campaigns.getProgressReport",
  campaign_get_health: "campaigns.getHealth",
  campaign_schedule_additional_posts: "campaigns.scheduleAdditionalPosts",
  strategy_get: "strategy.get",
  strategy_update: "strategy.update",
  research_run: "research",
  research_get: "research.get",
  writing_next_due: "writing.nextDue",
  writing_request_research: "writing.requestResearch",
  writing_confirm_research: "writing.confirmResearch",
  writing_revise_draft: "blogs.update",
  blogs_list: "blogs.list",
  blogs_get: "blogs.get",
  blogs_publish: "blogs.publish",
  blogs_unpublish: "blogs.unpublish",
  blogs_schedule: "blogs.schedule",
  blogs_unschedule: "blogs.cancelSchedule",
};

function stringField(data: unknown, key: string): string {
  if (!data || typeof data !== "object") return "";
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function numberField(data: unknown, key: string): number | undefined {
  if (!data || typeof data !== "object") return undefined;
  const value = (data as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

function recordField(data: unknown, key: string): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const value = (data as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function researchToolData(toolCalls: ChatTurnResponse["tool_calls"]): Record<string, unknown> | null {
  const call = [...toolCalls]
    .reverse()
    .find(
      (item) =>
        item.tool === "writing.requestResearch" ||
        item.tool === "research" ||
        Boolean(stringField(item.output_data, "report_markdown"))
    );
  if (!call?.output_data || typeof call.output_data !== "object") return null;
  return call.output_data as Record<string, unknown>;
}

function researchFailed(toolCalls: ChatTurnResponse["tool_calls"]): boolean {
  return toolCalls.some((call) => Boolean(stringField(call.output_data, "error")));
}

function writingConfirmPayload(args: {
  requestPayload?: Record<string, unknown>;
  research?: Record<string, unknown> | null;
  assistantContent: string;
  focus?: OrchestratorThread["focus"];
}): Record<string, unknown> | null {
  const source = args.requestPayload ?? {};
  const hitlArgs = payloadHitlRequests(source)[0]?.args ?? {};
  const research = args.research ?? {};
  const brief = recordField(research, "brief");
  const topic =
    stringField(research, "topic") ||
    stringField(source, "topic") ||
    stringField(hitlArgs, "topic") ||
    args.focus?.topic ||
    "";
  if (!topic) return null;
  const report = stringField(research, "report_markdown") || args.assistantContent.trim();
  const researchSummary =
    stringField(research, "spoken_summary") || stringField(source, "research_summary") || report.slice(0, 4000);
  return {
    package_id:
      stringField(research, "package_id") || stringField(source, "package_id") || stringField(hitlArgs, "package_id"),
    topic,
    intent:
      stringField(research, "intent") ||
      stringField(source, "intent") ||
      stringField(hitlArgs, "intent") ||
      args.focus?.intent ||
      "",
    campaign_id:
      stringField(research, "campaign_id") ||
      stringField(source, "campaign_id") ||
      stringField(hitlArgs, "campaign_id") ||
      args.focus?.campaign_id ||
      "",
    campaign_name:
      stringField(research, "campaign_name") ||
      stringField(source, "campaign_name") ||
      stringField(hitlArgs, "campaign_name"),
    sequence_index:
      numberField(research, "sequence_index") ??
      numberField(source, "sequence_index") ??
      numberField(hitlArgs, "sequence_index") ??
      args.focus?.roadmap_sequence_index,
    research_summary: researchSummary.slice(0, 4000),
    angle: stringField(brief, "angle") || stringField(source, "angle") || stringField(hitlArgs, "angle"),
    must_include:
      stringField(brief, "must_include") ||
      stringField(source, "must_include") ||
      stringField(hitlArgs, "must_include"),
    must_avoid:
      stringField(brief, "must_avoid") || stringField(source, "must_avoid") || stringField(hitlArgs, "must_avoid"),
    cta: stringField(brief, "cta") || stringField(source, "cta") || stringField(hitlArgs, "cta"),
    audience_notes:
      stringField(brief, "audience_notes") ||
      stringField(source, "audience_notes") ||
      stringField(hitlArgs, "audience_notes"),
    personal_notes:
      stringField(brief, "personal_notes") ||
      stringField(source, "personal_notes") ||
      stringField(hitlArgs, "personal_notes"),
  };
}

function preferResearchReport(assistantContent: string, toolCalls: ChatTurnResponse["tool_calls"]): string {
  const confirm = [...toolCalls].reverse().find((call) => call.tool === "writing.confirmResearch");
  const confirmBlogId = stringField(confirm?.output_data, "blog_id");
  const report = stringField(
    [...toolCalls].reverse().find((call) => Boolean(stringField(call.output_data, "report_markdown")))?.output_data,
    "report_markdown"
  );
  if (confirmBlogId) {
    const trimmed = assistantContent.trim();
    const drafting = confirm?.summary?.trim() || "Drafting has started. I'll notify you when it's ready to edit.";
    if (
      !trimmed ||
      trimmed.startsWith("{") ||
      (report && (trimmed === report || trimmed.length >= Math.min(report.length * 0.4, 800)))
    ) {
      return drafting;
    }
    return trimmed;
  }
  const research = [...toolCalls]
    .reverse()
    .find((call) => call.tool === "research" || Boolean(stringField(call.output_data, "report_markdown")));
  const researchReport = stringField(research?.output_data, "report_markdown") || report;
  if (!researchReport) {
    const trimmed = assistantContent.trim();
    if (trimmed.startsWith("{")) {
      const summary = [...toolCalls].reverse().find((call) => call.summary)?.summary;
      return summary || trimmed;
    }
    return assistantContent;
  }
  const trimmed = assistantContent.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.length < researchReport.length * 0.4) {
    return researchReport;
  }
  return trimmed;
}

function hasStartedDraft(toolCalls: ChatTurnResponse["tool_calls"]): boolean {
  return toolCalls.some(
    (call) => call.tool === "writing.confirmResearch" && Boolean(stringField(call.output_data, "blog_id"))
  );
}

function interruptActionName(result: Record<string, unknown>): string | undefined {
  const action = extractInterrupt(result)?.value?.actionRequests?.[0];
  return typeof action?.name === "string" ? action.name : undefined;
}

function hitlFallbackSummary(action: string | undefined): string {
  switch (action) {
    case "campaign_create":
      return "Campaign create requires your approval before it is saved.";
    case "campaign_update":
      return "Campaign update requires your approval before it is saved.";
    case "campaign_schedule_additional_posts":
      return "Scheduling additional posts requires your approval before it is saved.";
    case "writing_request_research":
      return "Start research for this post? Approve to research, or reject to keep discussing.";
    case "writing_confirm_research":
      return "Approve this research to start the background draft?";
    case "blogs_publish":
      return "Publish this blog post now?";
    case "blogs_unpublish":
      return "Unpublish this blog post?";
    case "blogs_schedule":
      return "Schedule this blog post?";
    case "blogs_unschedule":
      return "Cancel the scheduled publish for this post?";
    default:
      return "This change requires your approval before it is saved.";
  }
}

function hitlRejectMessage(action: string, note?: string): string {
  if (note?.trim()) return note.trim();
  if (action.startsWith("campaign_")) {
    return "User rejected this campaign change. Do not retry the same write unless they ask.";
  }
  if (action.startsWith("writing_")) {
    return "User rejected this writing step. Stay in discussion; do not retry the same HITL unless they ask.";
  }
  if (action.startsWith("blogs_")) {
    return "User rejected this post change. Do not retry the same publish or schedule unless they ask.";
  }
  return "User rejected this strategy update. Do not retry the same update unless they ask.";
}

function hasWritingFocus(focus?: ThreadFocusInput | OrchestratorThread["focus"]): boolean {
  return Boolean(focus?.blog_id || focus?.campaign_id || focus?.topic);
}

function toTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  if (content == null) {
    return "";
  }
  return String(content);
}

function resolveSessionMode(
  sessionMode?: ClientSessionMode,
  focus?: ThreadFocusInput | OrchestratorThread["focus"]
): ChatTurnResponse["active_session_mode"] {
  if (sessionMode && OPERATIONAL_MODES.has(sessionMode)) {
    return sessionMode as ChatTurnResponse["active_session_mode"];
  }
  if (hasWritingFocus(focus)) {
    return "writing";
  }
  return "casual";
}

function extractInterrupt(result: Record<string, unknown>): Interrupt<HITLRequest> | undefined {
  const interrupts = result.__interrupt__;
  if (!Array.isArray(interrupts) || interrupts.length === 0) {
    return undefined;
  }
  return interrupts[0] as Interrupt<HITLRequest>;
}

function classifyHitlReply(message: string): "approve" | "reject" | "continue" {
  const text = message.trim().toLowerCase();
  if (/^(yes|y|ok|okay|sure|confirm|approved?|go ahead|do it|lgtm|please do)[\s!.]*$/.test(text)) {
    return "approve";
  }
  if (/^(no|n|nope|cancel|rejected?|don't|dont|never mind|nevermind)[\s!.]*$/.test(text)) {
    return "reject";
  }
  return "continue";
}

function snapshotHasInterrupt(snapshot: { tasks?: Array<{ interrupts?: unknown[] }> }): boolean {
  return (snapshot.tasks ?? []).some((task) => Array.isArray(task.interrupts) && task.interrupts.length > 0);
}

function parseToolPayload(content: unknown): {
  summary: string;
  output_data?: Record<string, unknown>;
} {
  const text = toTextContent(content).trim();
  if (!text) return { summary: "" };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary : text;
      return { summary, output_data: obj };
    }
  } catch {
    // Tool results are compact summaries when not JSON.
  }
  return { summary: text };
}

function extractClientToolCalls(messages: Array<Record<string, unknown>>): ChatTurnResponse["tool_calls"] {
  const calls: ChatTurnResponse["tool_calls"] = [];
  for (const message of messages) {
    const role =
      typeof message.getType === "function"
        ? (message.getType as () => string)()
        : String(message.role ?? message.type ?? "");
    if (role !== "tool") continue;
    const rawName =
      typeof message.name === "string" ? message.name : typeof message.tool_name === "string" ? message.tool_name : "";
    const clientName = TOOL_NAME_TO_CLIENT[rawName];
    if (!clientName) continue;
    const { summary, output_data } = parseToolPayload(message.content);
    calls.push({
      tool: clientName,
      summary,
      output_data,
    });
  }
  return calls;
}

@singleton()
export default class OrchestratorV2Service {
  constructor(
    private readonly threadRepository: OrchestratorThreadRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly siteService: SiteService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly threadService: ThreadService,
    private readonly writeLocks: ThreadWriteLockService
  ) {}

  async chat(input: OrchestratorV2ChatInput): Promise<ChatTurnResponse> {
    const { siteId, userId, message, threadId, sessionMode } = input;

    await this.assertSiteAccess(siteId, userId);
    const thread = await this.resolveThread(siteId, userId, threadId, input.focus);
    const resolvedThreadId = thread._id!.toString();
    await this.acquireWriteLock(siteId, resolvedThreadId, userId);
    const refresh = setInterval(() => {
      void this.writeLocks.refresh(siteId, resolvedThreadId, userId);
    }, 30_000);

    try {
      const focus = thread.focus;
      const activeSessionMode = resolveSessionMode(sessionMode, focus);

      await this.messageRepository.create({
        thread_id: resolvedThreadId,
        site_id: siteId,
        role: OrchestratorMessageRole.USER,
        content: message,
      });

      const agentMessage = buildEnrichedUserMessage({
        message,
        selectionContext: input.selectionContext,
        attachments: input.attachments,
      });

      const { assistantContent, pendingApproval, toolCalls } = await this.invokeAgent({
        siteId,
        userId,
        threadId: resolvedThreadId,
        message: agentMessage,
        sessionMode: activeSessionMode,
        conversationMode: Boolean(input.conversationMode),
        focus,
      }).catch((error: unknown) => this.rethrowAgentError(error, siteId, resolvedThreadId));

      const assistant = await this.messageRepository.create({
        thread_id: resolvedThreadId,
        site_id: siteId,
        role: OrchestratorMessageRole.ASSISTANT,
        content: assistantContent,
        pending_approval_id: pendingApproval?._id?.toString(),
        tool_calls: toolCalls.map((call) => ({
          tool: call.tool,
          input: {},
          output_summary: call.summary,
          output_data: call.output_data,
        })),
      });

      await this.threadRepository.touch(resolvedThreadId);
      await this.messageRepository.pruneThreadToMaxKeep(resolvedThreadId, siteId, env.orchestrator.maxThreadMessages);
      await this.threadService.invalidateAfterMessage(siteId, resolvedThreadId);
      void this.threadService.maybeAutoTitle(siteId, resolvedThreadId);

      return {
        thread_id: resolvedThreadId,
        assistant_message: {
          id: assistant._id!.toString(),
          content: assistant.content,
          created_at: assistant.created_at,
        },
        tool_calls: toolCalls,
        pending_approval: pendingApproval ? serializeApproval(pendingApproval) : null,
        active_session_mode: activeSessionMode,
        session_mode_source: sessionMode && sessionMode !== "auto" ? "explicit" : "inferred",
        workspace_status: "active",
        onboarding_completed: false,
      };
    } finally {
      clearInterval(refresh);
      await this.writeLocks.release(siteId, resolvedThreadId, userId);
      this.realtimeService.emitToSite(
        siteId,
        REALTIME_EVENTS.ORCHESTRATOR_TURN_COMPLETED,
        { thread_id: resolvedThreadId, user_id: userId },
        { siteId }
      );
    }
  }

  /**
   * Resume a LangGraph HITL interrupt after the user approves or rejects
   * via the existing approvals UI.
   */
  async resumeHitlApproval(
    approval: OrchestratorApproval,
    decision: "approved" | "rejected",
    note?: string
  ): Promise<void> {
    if (!V2_HITL_ACTIONS.has(approval.action)) {
      return;
    }
    const threadId = approval.thread_id;
    if (!threadId) {
      throw new NotFoundError("Approval is missing thread_id");
    }

    const userId = approval.requested_by_user_id;
    const siteId = approval.site_id;
    await this.assertSiteAccess(siteId, userId);

    const identity = await this.loadIdentity(siteId, userId);
    const thread = await this.threadRepository.findById(threadId, siteId);
    const agent = this.buildAgent({
      siteId,
      userId,
      threadId,
      identity,
      sessionMode: approval.action.startsWith("campaign_")
        ? "planning"
        : approval.action.startsWith("writing_")
          ? "writing"
          : "strategy",
      focus: thread?.focus,
    }) as unknown as AgentGraph;

    const config = {
      configurable: { thread_id: threadId },
      ...AGENT_INVOKE_CONFIG,
    };

    let snapshot: AgentGraphSnapshot | null = null;
    try {
      snapshot = await agent.getState(config);
    } catch {
      snapshot = null;
    }
    const hanging = hangingHitlRequests(snapshot, approval.payload);
    const resume: HITLResponse = hitlDecisionsForHanging({
      hanging,
      action: approval.action,
      decision,
      note,
    });
    const confirmHanging = hanging.some((request) => request.name === "writing_confirm_research");
    const programmaticConfirm = approval.action === "writing_confirm_research" && !confirmHanging;

    try {
      let result: Record<string, unknown> & { messages: Array<Record<string, unknown>> } = {
        messages: [],
      };
      if (!programmaticConfirm) {
        result = await this.invokeGraph(agent, new Command({ resume }), config);
      }

      let draftFallback: { blogId: string; topic: string; campaignId?: string } | null = null;
      if (decision === "approved" && approval.action === "writing_confirm_research") {
        const resumeCalls = extractClientToolCalls(result.messages ?? []);
        if (programmaticConfirm || !hasStartedDraft(resumeCalls)) {
          draftFallback = await startBoundWritingDraft({ siteId, userId, threadId }, approval.payload ?? {});
        }
        let guard = 0;
        while (interruptActionName(result) === "writing_confirm_research" && guard < 2) {
          guard += 1;
          result = await this.invokeGraph(
            agent,
            new Command({
              resume: {
                decisions: [
                  {
                    type: "reject",
                    message:
                      "The background draft already started. Do not call writing_confirm_research again. Confirm in one sentence that writing has begun. Do not repeat the research report.",
                  },
                ],
              },
            }),
            config
          );
        }
      }

      const turned = await this.turnFromResult(result, {
        siteId,
        userId,
        threadId,
      });
      let pendingApproval = turned.pendingApproval;
      if (
        decision === "approved" &&
        approval.action === "writing_request_research" &&
        !pendingApproval &&
        !hasStartedDraft(turned.toolCalls) &&
        !researchFailed(turned.toolCalls)
      ) {
        const payload = writingConfirmPayload({
          requestPayload: approval.payload,
          research: researchToolData(turned.toolCalls),
          assistantContent: turned.assistantContent,
          focus: thread?.focus,
        });
        if (payload) {
          pendingApproval = await this.createWritingConfirmHitl({
            siteId,
            userId,
            threadId,
            payload,
          });
        }
      }
      const toolCalls = draftFallback
        ? [
            ...turned.toolCalls,
            {
              tool: "writing.confirmResearch",
              summary: `Drafting "${draftFallback.topic}" in the background. I'll notify you when it's ready to edit.`,
              output_data: {
                blog_id: draftFallback.blogId,
                campaign_id: draftFallback.campaignId,
                topic: draftFallback.topic,
              },
            },
          ]
        : turned.toolCalls;
      let content =
        preferResearchReport(turned.assistantContent, toolCalls).trim() ||
        (pendingApproval && !hasStartedDraft(toolCalls)
          ? hitlFallbackSummary(pendingApproval.action)
          : decision === "rejected"
            ? "Okay — we'll keep discussing."
            : "");
      if (hasStartedDraft(toolCalls) || draftFallback) {
        const topic =
          draftFallback?.topic ||
          stringField(
            [...toolCalls].reverse().find((call) => call.tool === "writing.confirmResearch")?.output_data,
            "topic"
          ) ||
          "this post";
        content = await followUpAfterDraftStarted(siteId, topic);
      }
      if (content || toolCalls.length > 0 || pendingApproval) {
        await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: content || "I've prepared the next step. Please approve or reject it to continue.",
          pending_approval_id:
            hasStartedDraft(toolCalls) || draftFallback ? undefined : pendingApproval?._id?.toString(),
          tool_calls: toolCalls.map((call) => ({
            tool: call.tool,
            input: {},
            output_summary: call.summary,
            output_data: call.output_data,
          })),
        });
        await this.threadRepository.touch(threadId);
      }

      await this.approvalRepository.markExecuted(approval._id!.toString(), siteId, {
        ok: decision === "approved",
        summary:
          decision === "approved"
            ? `${approval.action} applied after approval.`
            : `${approval.action} rejected; agent resumed with feedback.`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        "Failed to resume HITL",
        err,
        { siteId, threadId, approvalId: approval._id?.toString() },
        "OrchestratorV2Service"
      );
      await this.approvalRepository.revertToPending(approval._id!.toString(), siteId);
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(
        err.message || "Could not apply that decision. Ask to update the campaign again, then confirm."
      );
    }
  }

  /** @deprecated Use resumeHitlApproval */
  async resumeStrategyApproval(
    approval: OrchestratorApproval,
    decision: "approved" | "rejected",
    note?: string
  ): Promise<void> {
    return this.resumeHitlApproval(approval, decision, note);
  }

  private async invokeAgent(args: {
    siteId: string;
    userId: string;
    threadId: string;
    message: string;
    sessionMode: ChatTurnResponse["active_session_mode"];
    conversationMode?: boolean;
    focus?: OrchestratorThread["focus"];
  }): Promise<{
    assistantContent: string;
    pendingApproval: OrchestratorApproval | null;
    toolCalls: ChatTurnResponse["tool_calls"];
  }> {
    const identity = await this.loadIdentity(args.siteId, args.userId);
    const agent = this.buildAgent({
      siteId: args.siteId,
      userId: args.userId,
      threadId: args.threadId,
      identity,
      sessionMode: args.sessionMode,
      conversationMode: args.conversationMode,
      focus: args.focus,
      userMessage: args.message,
    }) as unknown as AgentGraph;
    const config = {
      configurable: { thread_id: args.threadId },
      ...AGENT_INVOKE_CONFIG,
    };

    let snapshot: AgentGraphSnapshot | null = null;
    try {
      snapshot = await agent.getState({ configurable: { thread_id: args.threadId } });
    } catch {
      snapshot = null;
    }
    if (snapshot && snapshotHasInterrupt(snapshot)) {
      const intent = classifyHitlReply(args.message);
      const hanging = hangingHitlRequests(snapshot);
      const primary = primaryHitlAction(hanging);
      if (intent === "approve" || intent === "reject") {
        const resumed = await this.invokeGraph(
          agent,
          new Command({
            resume: hitlDecisionsForHanging({
              hanging,
              action: primary,
              decision: intent === "approve" ? "approved" : "rejected",
              note: args.message,
            }),
          }),
          config
        );
        await this.closePendingThreadHitl(args.threadId, args.siteId, args.userId, intent);
        return this.turnFromResult(resumed, {
          siteId: args.siteId,
          userId: args.userId,
          threadId: args.threadId,
        });
      }

      await this.invokeGraph(
        agent,
        new Command({
          resume: hitlDecisionsForHanging({
            hanging,
            action: primary,
            decision: "rejected",
            note: "User continued the conversation without confirming. Do not retry the same write unless they ask again.",
          }),
        }),
        config
      );
      await this.closePendingThreadHitl(args.threadId, args.siteId, args.userId, "reject");
    } else if (snapshot) {
      await this.healDanglingToolCalls(agent, config, snapshot);
    }

    const result = await this.invokeGraph(agent, { messages: [{ role: "user", content: args.message }] }, config);
    return this.turnFromResult(result, {
      siteId: args.siteId,
      userId: args.userId,
      threadId: args.threadId,
    });
  }

  private async invokeGraph(
    agent: AgentGraph,
    input: { messages: Array<{ role: string; content: string }> } | Command,
    config: AgentGraphConfig
  ) {
    return (await agent.invoke(input, config)) as Record<string, unknown> & {
      messages: Array<Record<string, unknown>>;
    };
  }

  private async turnFromResult(
    result: Record<string, unknown> & { messages: Array<Record<string, unknown>> },
    createApprovalFor?: { siteId: string; userId: string; threadId: string }
  ): Promise<{
    assistantContent: string;
    pendingApproval: OrchestratorApproval | null;
    toolCalls: ChatTurnResponse["tool_calls"];
  }> {
    const toolCalls = extractClientToolCalls(result.messages ?? []);
    const interrupt = extractInterrupt(result);
    if (interrupt?.value && createApprovalFor) {
      const hitl = interrupt.value;
      const requests = Array.isArray(hitl.actionRequests) ? hitl.actionRequests : [];
      const actionName = primaryHitlAction(requests as HitlActionRequest[], "strategy_update");
      const action = requests.find((item) => item?.name === actionName) ?? requests[0];
      const lastMessageContent = toTextContent(result.messages?.[result.messages.length - 1]?.content);
      if (actionName === "writing_confirm_research" && hasStartedDraft(toolCalls)) {
        return {
          assistantContent:
            preferResearchReport(lastMessageContent, toolCalls).trim() ||
            "Drafting has started. I'll notify you when it's ready to edit.",
          pendingApproval: null,
          toolCalls,
        };
      }
      const summary = action?.description?.trim() || hitlFallbackSummary(actionName);

      const pendingApproval = await this.approvalRepository.create({
        site_id: createApprovalFor.siteId,
        thread_id: createApprovalFor.threadId,
        requested_for_user_id: createApprovalFor.userId,
        requested_by_user_id: createApprovalFor.userId,
        kind: OrchestratorApprovalKind.IN_CHAT_CONFIRMATION,
        action: actionName,
        summary: summary.slice(0, 2000),
        payload: {
          ...(action?.args ?? {}),
          _hitl: {
            actionRequests: hitl.actionRequests,
            reviewConfigs: hitl.reviewConfigs,
          },
        },
        expires_at: new Date(Date.now() + env.orchestrator.confirmTimeoutMs),
      });
      this.emitApprovalCreated(pendingApproval);

      const assistantContent =
        preferResearchReport(lastMessageContent, toolCalls).trim() ||
        (actionName === "writing_confirm_research"
          ? "I've finished research. Approve to start the draft, or reject to keep discussing."
          : "I've prepared a change. Please approve or reject it to continue.");

      return { assistantContent, pendingApproval, toolCalls };
    }

    return {
      assistantContent: preferResearchReport(
        toTextContent(result.messages[result.messages.length - 1]?.content),
        toolCalls
      ),
      pendingApproval: null,
      toolCalls,
    };
  }

  private async closePendingThreadHitl(
    threadId: string,
    siteId: string,
    userId: string,
    intent: "approve" | "reject"
  ): Promise<void> {
    const pending = await this.approvalRepository.findPendingForThread(threadId, siteId);
    if (!pending?._id || !V2_HITL_ACTIONS.has(pending.action)) {
      return;
    }
    const approvalId = pending._id.toString();
    await this.approvalRepository.decide(
      approvalId,
      siteId,
      intent === "approve" ? OrchestratorApprovalStatus.APPROVED : OrchestratorApprovalStatus.REJECTED,
      userId
    );
    await this.approvalRepository.markExecuted(approvalId, siteId, {
      ok: intent === "approve",
      summary:
        intent === "approve"
          ? `${pending.action} applied after approval.`
          : `${pending.action} rejected; conversation continued.`,
    });
  }

  private async healDanglingToolCalls(
    agent: AgentGraph,
    config: AgentGraphConfig,
    snapshot: AgentGraphSnapshot
  ): Promise<void> {
    const messages = snapshot.values?.messages ?? [];
    const answered = new Set<string>();
    for (const message of messages) {
      const id = typeof message.tool_call_id === "string" ? message.tool_call_id : undefined;
      const role =
        typeof message.getType === "function"
          ? (message.getType as () => string)()
          : String(message.role ?? message.type ?? "");
      if (id && role === "tool") {
        answered.add(id);
      }
    }

    let lastToolCalls: Array<{ id?: string; name?: string }> = [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      const role =
        typeof message.getType === "function"
          ? (message.getType as () => string)()
          : String(message.role ?? message.type ?? "");
      if (role === "ai" || role === "assistant") {
        lastToolCalls = Array.isArray(message.tool_calls)
          ? (message.tool_calls as Array<{ id?: string; name?: string }>)
          : [];
        break;
      }
    }

    const dangling = lastToolCalls.filter((call) => typeof call.id === "string" && call.id && !answered.has(call.id));
    if (dangling.length === 0) {
      return;
    }

    await agent.updateState(config, {
      messages: dangling.map(
        (call) =>
          new ToolMessage({
            content:
              "Cancelled because the previous tool call was left unanswered. Continue with the user's latest message.",
            tool_call_id: call.id as string,
            name: call.name,
          })
      ),
    });
  }

  private buildAgent(args: {
    siteId: string;
    userId: string;
    threadId?: string;
    identity: LongTermMemoryIdentity;
    sessionMode: string;
    conversationMode?: boolean;
    focus?: OrchestratorThread["focus"];
    userMessage?: string;
  }) {
    if (!env.orchestrator.openaiApiKey) {
      throw new BadRequestError(
        "Workspace orchestrator is not configured. Set ORCHESTRATOR_OPENAI_API_KEY or OPENAI_API_KEY in the server environment."
      );
    }

    const middleware: AnyAgentMiddleware[] = [
      piiMiddleware,
      createSummarizationMiddleware(),
      createLongTermMemoryMiddleware(args.identity),
      createSkillMiddleware({
        siteId: args.siteId,
        userId: args.userId,
        threadId: args.threadId,
        writingLoop: args.sessionMode === "writing" || hasWritingFocus(args.focus),
      }),
      createSkillHitlMiddleware({ siteId: args.siteId }),
    ];

    return createAgent({
      model: createChatOpenAI({
        apiKey: env.orchestrator.openaiApiKey,
        model: AGENT_MODEL,
        timeout: env.orchestrator.API_TIMEOUT,
      }),
      systemPrompt: buildRoleAwareSystemPrompt({
        userName: args.identity.userName,
        workspaceName: args.identity.workspaceName,
        companyRole: args.identity.companyRole,
        companyRoleDetail: args.identity.companyRoleDetail,
        sessionMode: args.sessionMode,
        conversationMode: args.conversationMode,
        focus: args.focus,
        userMessage: args.userMessage,
      }),
      middleware,
      checkpointer: v2Checkpointer,
    });
  }

  private rethrowAgentError(error: unknown, siteId: string, threadId: string): never {
    if (error instanceof PIIDetectionError) {
      throw new BadRequestError(
        "That message contains sensitive data I can't process. Remove API keys or secrets and try again."
      );
    }
    if (error instanceof GraphRecursionError) {
      logger.error("Orchestrator v2 hit graph recursion limit", error, { siteId, threadId }, "OrchestratorV2Service");
      throw new BadRequestError("I got stuck working through that request. Please try again with a shorter message.");
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/INVALID_TOOL_RESULTS|tool_call_id/i.test(message)) {
      throw new BadRequestError(
        "This conversation got stuck on a previous approval. Start a new thread and ask to update the campaign again."
      );
    }
    throw error;
  }

  private async loadIdentity(siteId: string, userId: string) {
    const [site, memberRole, user] = await Promise.all([
      this.siteService.getSiteById(siteId, userId),
      this.siteService.getUserRole(siteId, userId),
      this.userRepository.findById(userId),
    ]);

    const userName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();

    return {
      userId,
      siteId,
      userName: userName || undefined,
      workspaceName: site.name,
      companyRole: user?.company_role,
      companyRoleDetail: user?.company_role_detail,
      memberRole: memberRole ?? undefined,
    };
  }

  private async createWritingConfirmHitl(args: {
    siteId: string;
    userId: string;
    threadId: string;
    payload: Record<string, unknown>;
  }): Promise<OrchestratorApproval> {
    const pendingApproval = await this.approvalRepository.create({
      site_id: args.siteId,
      thread_id: args.threadId,
      requested_for_user_id: args.userId,
      requested_by_user_id: args.userId,
      kind: OrchestratorApprovalKind.IN_CHAT_CONFIRMATION,
      action: "writing_confirm_research",
      summary: formatWritingConfirmResearchDraft(args.payload).slice(0, 2000),
      payload: args.payload,
      expires_at: new Date(Date.now() + env.orchestrator.confirmTimeoutMs),
    });
    this.emitApprovalCreated(pendingApproval);
    return pendingApproval;
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

  private async resolveThread(
    siteId: string,
    userId: string,
    threadId: string | undefined,
    incomingFocus?: ThreadFocusInput
  ): Promise<OrchestratorThread> {
    if (threadId) {
      const found = await this.threadRepository.findById(threadId, siteId);
      if (!found) {
        throw new NotFoundError("Thread not found");
      }
      const merged = mergeFocus(found.focus, incomingFocus);
      if (incomingFocus && merged) {
        const updated = await this.threadRepository.setFocus(threadId, siteId, merged);
        return updated ?? { ...found, focus: merged };
      }
      return found;
    }

    return this.threadService.create({
      siteId,
      userId,
      focus: incomingFocus,
    });
  }

  private async acquireWriteLock(siteId: string, threadId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || "A teammate";
    const lock = await this.writeLocks.acquire(siteId, threadId, userId, name);
    if (!lock.ok) {
      throw new ThreadBusyError(lock.holder);
    }
    this.realtimeService.emitToSite(
      siteId,
      REALTIME_EVENTS.ORCHESTRATOR_TURN_STARTED,
      { thread_id: threadId, user_id: userId, name },
      { siteId }
    );
  }

  private async assertSiteAccess(siteId: string, userId: string): Promise<void> {
    const has = await this.siteService.hasSiteAccess(siteId, userId);
    if (!has) {
      throw new ForbiddenError("You do not have access to this workspace");
    }
  }
}

type LongTermMemoryIdentity = {
  userId: string;
  siteId: string;
  userName?: string;
  workspaceName?: string;
  companyRole?: string;
  companyRoleDetail?: string;
  memberRole?: string;
};
