import { injectable } from "tsyringe";
import {
  createAgent,
  type AnyAgentMiddleware,
  type HITLRequest,
  type HITLResponse,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { Command, MemorySaver, type Interrupt } from "@langchain/langgraph";
import {
  createLongTermMemoryMiddleware,
  createSkillMiddleware,
  createStrategyHitlMiddleware,
  piiMiddlewares,
  summarizationMw,
} from "./orchestrator.middleware";
import { AGENT_MODEL } from "./orchestrator.constants";
import { buildRoleAwareSystemPrompt } from "./prompts";
import { OrchestratorThreadRepository } from "../orchestrator/repositories/orchestrator-thread.repository";
import { OrchestratorMessageRepository } from "../orchestrator/repositories/orchestrator-message.repository";
import { OrchestratorApprovalRepository } from "../orchestrator/repositories/orchestrator-approval.repository";
import { SiteService } from "../site/services/site.service";
import { ForbiddenError, NotFoundError } from "../../shared/errors";
import { env } from "../../shared/config/env";
import {
  serializeApproval,
  type ChatTurnResponse,
} from "../orchestrator/interfaces/orchestrator.interface";
import type { OrchestratorThread } from "../../shared/schemas/orchestrator-thread.schema";
import { OrchestratorMessageRole } from "../../shared/schemas/orchestrator-message.schema";
import {
  OrchestratorApprovalKind,
  type OrchestratorApproval,
} from "../../shared/schemas/orchestrator-approval.schema";
import type { ClientSessionMode } from "../orchestrator/utils/turn-context.helper";
import User from "../../shared/schemas/user.schema";
import { RealtimeService, REALTIME_EVENTS } from "../../shared/realtime";
import { NotificationService } from "../notification/services/notification.service";
import { notifyApprovalCreatedInApp } from "../../shared/utils/notify-approval-created.util";
import { logger } from "../../shared/utils/logger";

export type OrchestratorV2ChatInput = {
  siteId: string;
  userId: string;
  message: string;
  threadId?: string;
  sessionMode?: ClientSessionMode;
};

const OPERATIONAL_MODES = new Set([
  "planning",
  "writing",
  "research",
  "review",
  "casual",
  "strategy",
]);

const STRATEGY_UPDATE_ACTION = "strategy_update";

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
): ChatTurnResponse["active_session_mode"] {
  if (sessionMode && OPERATIONAL_MODES.has(sessionMode)) {
    return sessionMode as ChatTurnResponse["active_session_mode"];
  }
  return "casual";
}

function extractInterrupt(
  result: Record<string, unknown>,
): Interrupt<HITLRequest> | undefined {
  const interrupts = result.__interrupt__;
  if (!Array.isArray(interrupts) || interrupts.length === 0) {
    return undefined;
  }
  return interrupts[0] as Interrupt<HITLRequest>;
}

@injectable()
export default class OrchestratorV2Service {
  private readonly checkpointer = new MemorySaver();

  constructor(
    private readonly threadRepository: OrchestratorThreadRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly siteService: SiteService,
    private readonly realtimeService: RealtimeService,
    private readonly notificationService: NotificationService,
  ) {}

  async chat(input: OrchestratorV2ChatInput): Promise<ChatTurnResponse> {
    const { siteId, userId, message, threadId, sessionMode } = input;

    await this.assertSiteAccess(siteId, userId);
    const thread = await this.resolveThread(siteId, userId, threadId);
    const resolvedThreadId = thread._id!.toString();
    const activeSessionMode = resolveSessionMode(sessionMode);

    await this.messageRepository.create({
      thread_id: resolvedThreadId,
      site_id: siteId,
      role: OrchestratorMessageRole.USER,
      content: message,
    });

    const { assistantContent, pendingApproval } = await this.invokeAgent({
      siteId,
      userId,
      threadId: resolvedThreadId,
      message,
      sessionMode: activeSessionMode,
    });

    const assistant = await this.messageRepository.create({
      thread_id: resolvedThreadId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: assistantContent,
      pending_approval_id: pendingApproval?._id?.toString(),
    });

    await this.threadRepository.touch(resolvedThreadId);
    await this.messageRepository.pruneThreadToMaxKeep(
      resolvedThreadId,
      siteId,
      env.orchestrator.maxThreadMessages,
    );

    return {
      thread_id: resolvedThreadId,
      assistant_message: {
        id: assistant._id!.toString(),
        content: assistant.content,
        created_at: assistant.created_at,
      },
      tool_calls: [],
      pending_approval: pendingApproval
        ? serializeApproval(pendingApproval)
        : null,
      active_session_mode: activeSessionMode,
      session_mode_source:
        sessionMode && sessionMode !== "auto" ? "explicit" : "inferred",
      workspace_status: "active",
      onboarding_completed: false,
    };
  }

  /**
   * Resume a LangGraph HITL interrupt for strategy_update after the user
   * approves or rejects via the existing approvals UI.
   */
  async resumeStrategyApproval(
    approval: OrchestratorApproval,
    decision: "approved" | "rejected",
    note?: string,
  ): Promise<void> {
    if (approval.action !== STRATEGY_UPDATE_ACTION) {
      return;
    }
    const threadId = approval.thread_id;
    if (!threadId) {
      throw new NotFoundError("Strategy approval is missing thread_id");
    }

    const userId = approval.requested_by_user_id;
    const siteId = approval.site_id;
    await this.assertSiteAccess(siteId, userId);

    const identity = await this.loadIdentity(siteId, userId);
    const agent = this.buildAgent({
      siteId,
      userId,
      identity,
      sessionMode: "strategy",
    });

    const resume: HITLResponse =
      decision === "approved"
        ? { decisions: [{ type: "approve" }] }
        : {
            decisions: [
              {
                type: "reject",
                message:
                  note?.trim() ||
                  "User rejected this strategy update. Do not retry the same update unless they ask.",
              },
            ],
          };

    try {
      const result = await agent.invoke(new Command({ resume }), {
        configurable: { thread_id: threadId },
      });

      const followUp = toTextContent(
        result.messages?.[result.messages.length - 1]?.content,
      );
      if (followUp.trim()) {
        await this.messageRepository.create({
          thread_id: threadId,
          site_id: siteId,
          role: OrchestratorMessageRole.ASSISTANT,
          content: followUp,
        });
        await this.threadRepository.touch(threadId);
      }

      await this.approvalRepository.markExecuted(approval._id!.toString(), siteId, {
        ok: decision === "approved",
        summary:
          decision === "approved"
            ? "Strategy update applied after approval."
            : "Strategy update rejected; agent resumed with feedback.",
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(
        "Failed to resume strategy HITL",
        err,
        { siteId, threadId, approvalId: approval._id?.toString() },
        "OrchestratorV2Service",
      );
      await this.approvalRepository.markExecuted(approval._id!.toString(), siteId, {
        ok: false,
        error: err.message,
      });
      throw error;
    }
  }

  private async invokeAgent(args: {
    siteId: string;
    userId: string;
    threadId: string;
    message: string;
    sessionMode: ChatTurnResponse["active_session_mode"];
  }): Promise<{
    assistantContent: string;
    pendingApproval: OrchestratorApproval | null;
  }> {
    const identity = await this.loadIdentity(args.siteId, args.userId);
    const agent = this.buildAgent({
      siteId: args.siteId,
      userId: args.userId,
      identity,
      sessionMode: args.sessionMode,
    });

    const result = (await agent.invoke(
      {
        messages: [
          {
            role: "user",
            content: args.message,
          },
        ],
      },
      { configurable: { thread_id: args.threadId } },
    )) as Record<string, unknown> & {
      messages: Array<{ content?: unknown }>;
    };

    const interrupt = extractInterrupt(result);
    if (interrupt?.value) {
      const hitl = interrupt.value;
      const action = hitl.actionRequests?.[0];
      const summary =
        action?.description?.trim() ||
        "Strategy update requires your approval before it is saved.";

      const pendingApproval = await this.approvalRepository.create({
        site_id: args.siteId,
        thread_id: args.threadId,
        requested_for_user_id: args.userId,
        requested_by_user_id: args.userId,
        kind: OrchestratorApprovalKind.IN_CHAT_CONFIRMATION,
        action: STRATEGY_UPDATE_ACTION,
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

      const lastMessageContent = toTextContent(
        result.messages?.[result.messages.length - 1]?.content,
      );
      const assistantContent =
        lastMessageContent.trim() ||
        "I've prepared a strategy update. Please approve or reject it to continue.";

      return { assistantContent, pendingApproval };
    }

    return {
      assistantContent: toTextContent(
        result.messages[result.messages.length - 1]?.content,
      ),
      pendingApproval: null,
    };
  }

  private buildAgent(args: {
    siteId: string;
    userId: string;
    identity: LongTermMemoryIdentity;
    sessionMode: string;
  }) {
    const middleware: AnyAgentMiddleware[] = [
      ...piiMiddlewares,
      summarizationMw,
      createLongTermMemoryMiddleware(args.identity),
      createSkillMiddleware({ siteId: args.siteId, userId: args.userId }),
      createStrategyHitlMiddleware(),
    ];

    return createAgent({
      model: new ChatOpenAI({ model: AGENT_MODEL }),
      systemPrompt: buildRoleAwareSystemPrompt({
        userName: args.identity.userName,
        workspaceName: args.identity.workspaceName,
        companyRole: args.identity.companyRole,
        companyRoleDetail: args.identity.companyRoleDetail,
        sessionMode: args.sessionMode,
      }),
      middleware,
      checkpointer: this.checkpointer,
    });
  }

  private async loadIdentity(siteId: string, userId: string) {
    const [site, memberRole, user] = await Promise.all([
      this.siteService.getSiteById(siteId, userId),
      this.siteService.getUserRole(siteId, userId),
      User.findById(userId)
        .select("first_name last_name company_role company_role_detail")
        .lean(),
    ]);

    const userName = [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

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
      { siteId },
    );
    void notifyApprovalCreatedInApp(this.notificationService, approval);
  }

  private async resolveThread(
    siteId: string,
    userId: string,
    threadId: string | undefined,
  ): Promise<OrchestratorThread> {
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
