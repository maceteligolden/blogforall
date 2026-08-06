import { injectable } from "tsyringe";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { TokenEnforcementService } from "../../token-ledger/services/token-enforcement.service";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { env } from "../../../shared/config/env";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { OrchestratorApprovalKind } from "../../../shared/schemas/orchestrator-approval.schema";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import {
  parseSupervisorDecisionFromRaw,
  supervisorDecisionRawSchema,
  type SupervisorDecision,
} from "../interfaces/orchestrator.interface";
import { renderActiveSystemPrompt, renderOnboardingSystemPrompt } from "./prompts/system";
import { OrchestratorToolRegistry } from "./tool-registry";
import { normalizeBlogToolInput } from "./tools/_helpers";
import { formatOnboardingProgress } from "../utils/onboarding-interview.helper";
import { getSessionModeInstructions } from "../utils/turn-context.helper";
import { buildSelectionFocusSystemInstructions, isDraftApplyRequest } from "../utils/selection-focus.helper";
import {
  assessSurgicalUpdatePreservation,
  buildConcernedEditReply,
  buildContextualSurgicalEditPrompt,
} from "../utils/surgical-edit.helper";
import type { SelectionContextPayload } from "../utils/selection-focus.helper";
import { SiteMemberRole } from "../../../shared/constants";
import { canRunOrchestratorTool, filterToolsForRole } from "../../../shared/utils/site-permissions.util";
import { buildVoiceConversationInstructions } from "../utils/voice-conversation.helper";

export interface PlanTurnInput {
  siteId: string;
  userId: string;
  memberRole: SiteMemberRole | null;
  threadId: string;
  workspaceName: string;
  workspaceId: string;
  mode: "active" | "onboarding";
  memory: WorkspaceMemory;
  /** Chronological prior turns from DB; the new user message is appended below. */
  history: OrchestratorMessage[];
  /** The user's new turn (already validated, not yet persisted). */
  newUserMessage: string;
  /** Enriched message for the LLM (includes attachments/selection/knowledge). */
  enrichedUserMessage?: string;
  sessionMode?: import("../utils/turn-context.helper").OperationalSessionMode;
  clientSessionMode?: import("../utils/turn-context.helper").ClientSessionMode;
  selectionContext?: SelectionContextPayload;
  /** Live voice call — restricts tools and enforces conversational probing. */
  conversationMode?: boolean;
  /** Optional abort signal forwarded to the underlying ChatOpenAI calls. */
  signal?: AbortSignal;
}

export interface PlanTurnOutput {
  decision: SupervisorDecision;
  /** Result of the tool the supervisor chose to invoke, if any. */
  tool_invocation: null | {
    name: string;
    input: Record<string, unknown>;
    /** Tool ran without throwing; payload is the tool's `data`. */
    ok: boolean;
    summary: string;
    data?: unknown;
    error?: string;
  };
  /** When a draft edit chains blogs.get → blogs.update in one turn, the get step is stored here for history. */
  prior_tool_invocation?: PlanTurnOutput["tool_invocation"];
  /** Final user-facing assistant reply for this turn (may be empty if tool errored). */
  assistant_reply: string;
}

/**
 * Planner for one Workspace Orchestrator turn.
 *
 * Responsibilities (pure; no DB writes):
 *  1. Render the system prompt with workspace context + memory summary.
 *  2. Ask the supervisor LLM for a structured `SupervisorDecision`.
 *  3. If the decision is `call_tool`, look up the tool in the registry,
 *     invoke it inside the request's tenant context, then ask the LLM for
 *     a natural-language summary of the result.
 *  4. Return `decision`, `tool_invocation`, and `assistant_reply`.
 *
 * All persistence (messages, approvals, memory writes, onboarding flip)
 * happens in `OrchestratorService` (Phase 2.4). Keeping the planner pure
 * makes it trivial to unit-test against a mocked ChatOpenAI.
 */
@injectable()
export class OrchestratorGraphService {
  constructor(
    private readonly toolRegistry: OrchestratorToolRegistry,
    private readonly tokenEnforcement: TokenEnforcementService
  ) {}

  assertConfigured(): void {
    if (!env.orchestrator.openaiApiKey) {
      throw new BadRequestError(
        "Workspace orchestrator is not configured. Set ORCHESTRATOR_OPENAI_API_KEY or OPENAI_API_KEY in the server environment."
      );
    }
  }

  private buildChat(): ChatOpenAI {
    return createChatOpenAI({
      apiKey: env.orchestrator.openaiApiKey,
      model: env.orchestrator.supervisorModel,
      timeout: env.orchestrator.API_TIMEOUT,
      temperature: 0.3,
    });
  }

  async planTurn(input: PlanTurnInput): Promise<PlanTurnOutput> {
    this.assertConfigured();

    // Render the tool manifest with descriptions so the supervisor can pick
    // the right tool by purpose, not just by guessing names. (debug H12: the
    // model previously hallucinated `blog_generation` because we only fed it
    // bare names like `blogs.generateDraft` with no description, then later
    // claimed in chat that the tool was "unavailable".)
    const roleFiltered =
      input.mode === "onboarding" ? [] : filterToolsForRole(this.toolRegistry.manifest(), input.memberRole);

    const manifestTools = roleFiltered;

    const availableTools =
      input.mode === "onboarding"
        ? [
            "workspace.completeOnboarding — Capture business_description, customers, brand_voice, business_goals (plus optional model/industries/competitors/negatives) and finalize onboarding.",
          ]
        : manifestTools.map((t) => {
            const tag = t.requiresConfirmation ? " (requires confirmation)" : "";
            return `${t.name}${tag} — ${t.description}`;
          });

    const nowDate = new Date();
    const currentTimeIso = nowDate.toISOString();
    const currentDateHuman = nowDate.toUTCString();
    const promptCtx = {
      workspace_name: input.workspaceName,
      workspace_id: input.workspaceId,
      workspace_context_json: this.buildContextJson(input.memory),
      memory_summary: input.memory.memory_summary || "",
      onboarding_progress: input.mode === "onboarding" ? formatOnboardingProgress(input.memory) : undefined,
      available_tools: availableTools,
      current_time_iso: currentTimeIso,
      current_date_human: currentDateHuman,
      session_mode_instructions:
        input.mode === "active"
          ? getSessionModeInstructions(input.sessionMode, { clientMode: input.clientSessionMode })
          : undefined,
      selection_focus_instructions:
        input.mode === "active" && input.selectionContext
          ? buildSelectionFocusSystemInstructions(input.selectionContext)
          : undefined,
      voice_conversation_instructions:
        input.mode === "active" && input.conversationMode
          ? buildVoiceConversationInstructions(input.sessionMode, { userMessage: input.newUserMessage })
          : undefined,
    };
    const systemPromptText =
      input.mode === "onboarding" ? renderOnboardingSystemPrompt(promptCtx) : renderActiveSystemPrompt(promptCtx);

    const messages = this.buildMessageHistory(
      systemPromptText,
      input.history,
      input.enrichedUserMessage ?? input.newUserMessage
    );

    const chat = this.buildChat();
    const planner = chat.withStructuredOutput(supervisorDecisionRawSchema);
    let decision: SupervisorDecision;
    try {
      const raw = await planner.invoke(messages, { signal: input.signal });
      decision = parseSupervisorDecisionFromRaw(raw);
    } catch (e) {
      logger.error(
        "Orchestrator supervisor call failed",
        e as Error,
        { siteId: input.siteId, threadId: input.threadId, mode: input.mode },
        "OrchestratorGraphService"
      );
      throw new BadRequestError("The orchestrator could not produce a plan for this turn. Please retry.");
    }

    logger.info(
      "Orchestrator decision",
      {
        siteId: input.siteId,
        threadId: input.threadId,
        next: decision.next,
        tool: decision.tool?.name,
        mode: input.mode,
      },
      "OrchestratorGraphService"
    );

    if (decision.next !== "call_tool") {
      return {
        decision,
        tool_invocation: null,
        assistant_reply: this.fallbackReply(decision),
      };
    }

    // call_tool path: invoke the tool inside the request's tenant context,
    // then ask the supervisor to write a user-facing summary of the result.
    const toolName = decision.tool?.name;
    if (!toolName) {
      return {
        decision,
        tool_invocation: null,
        assistant_reply:
          "I tried to call a tool but didn't get a tool name from the planner. Please rephrase your request.",
      };
    }

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      const reply = `The tool '${toolName}' isn't available in this workspace yet. I'll skip it.`;
      return {
        decision,
        tool_invocation: { name: toolName, input: decision.tool!.input, ok: false, summary: reply, error: "not_found" },
        assistant_reply: reply,
      };
    }

    if (!canRunOrchestratorTool(input.memberRole, toolName, tool.requiresConfirmation)) {
      const reply =
        "Your workspace role doesn't allow that action. Editors can create and update content but cannot delete or change workspace settings. Ask a workspace admin if you need this done.";
      return {
        decision,
        tool_invocation: { name: toolName, input: decision.tool!.input, ok: false, summary: reply, error: "forbidden" },
        assistant_reply: reply,
      };
    }

    // Destructive tools must always be gated. If the planner tried to call
    // one directly without a prior confirmation, we transform the call into
    // a confirmation request so the human is in the loop.
    if (tool.requiresConfirmation) {
      const summary = decision.reply || `Confirm: ${tool.description}`;
      const payload = (decision.tool?.input ?? {}) as Record<string, unknown>;
      logger.info(
        "Destructive tool call intercepted; raising confirmation instead",
        { siteId: input.siteId, threadId: input.threadId, tool: toolName },
        "OrchestratorGraphService"
      );
      const gatedDecision: SupervisorDecision = {
        reasoning: decision.reasoning,
        next: "request_confirmation",
        reply: decision.reply,
        tool: null,
        confirmation: {
          action: toolName,
          payload,
          summary,
          kind: tool.confirmationKind ?? OrchestratorApprovalKind.IN_CHAT_CONFIRMATION,
        },
        confirmation_decision: null,
        memory_patch: decision.memory_patch,
        onboarding_payload: decision.onboarding_payload,
      };
      return {
        decision: gatedDecision,
        tool_invocation: null,
        assistant_reply: summary,
      };
    }

    try {
      const highlightExcerpt =
        input.selectionContext?.reference_type !== "blog" ? input.selectionContext?.text?.trim() : undefined;
      const highlightDiscussionOnly =
        toolName === "blogs.get" && !!highlightExcerpt && !isDraftApplyRequest(input.newUserMessage);

      if (highlightDiscussionOnly) {
        const assistantReply = await this.discussHighlightInChat({
          chat,
          messages,
          excerpt: highlightExcerpt!,
          userMessage: input.newUserMessage,
          signal: input.signal,
        });
        return {
          decision: { ...decision, next: "respond", tool: null },
          tool_invocation: null,
          assistant_reply: assistantReply,
        };
      }

      const rawToolInput = (decision.tool!.input ?? {}) as Record<string, unknown>;
      const toolInput = prepareBlogToolInput(toolName, rawToolInput, input.selectionContext);

      if (toolName === "blogs.update" && input.selectionContext?.text && typeof toolInput.content === "string") {
        const originalHtml = await this.fetchBlogContentHtml(
          input,
          String(toolInput.id ?? input.selectionContext.blog_id)
        );
        if (originalHtml.length > 200) {
          const preservation = assessSurgicalUpdatePreservation(originalHtml, toolInput.content, {
            excerpt: input.selectionContext.text,
            userMessage: input.newUserMessage,
          });
          if (!preservation.ok) {
            return {
              decision,
              tool_invocation: null,
              assistant_reply: buildConcernedEditReply(
                preservation.concern ?? "the edit may remove too much of the draft"
              ),
            };
          }
        }
      }

      const result = await this.tokenEnforcement.runNested(() =>
        tool.run({
          siteId: input.siteId,
          userId: input.userId,
          threadId: input.threadId,
          input: toolInput,
        })
      );

      const getInvocation = {
        name: toolName,
        input: toolInput,
        ok: true as const,
        summary: result.summary,
        data: result.data,
      };

      if (toolName === "blogs.get" && input.selectionContext?.blog_id && isDraftApplyRequest(input.newUserMessage)) {
        const chained = await this.attemptChainedBlogUpdate({
          input,
          messages,
          chat,
          systemPromptText,
          getInvocation,
          getData: (result.data ?? {}) as Record<string, unknown>,
          signal: input.signal,
        });
        if (chained) return chained;
      }

      const reply = await this.summarizeToolResult({
        chat,
        systemPromptText,
        history: messages,
        toolName,
        toolSummary: result.summary,
        signal: input.signal,
      });
      return {
        decision,
        tool_invocation: getInvocation,
        assistant_reply: reply,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn(
        "Orchestrator tool errored",
        { siteId: input.siteId, threadId: input.threadId, tool: toolName, error: errorMessage },
        "OrchestratorGraphService"
      );
      return {
        decision,
        tool_invocation: {
          name: toolName,
          input: decision.tool!.input,
          ok: false,
          summary: errorMessage,
          error: errorMessage,
        },
        assistant_reply: `I tried to run '${toolName}' but it failed: ${errorMessage}`,
      };
    }
  }

  /** Answer highlight discussion in chat without blogs.get — excerpt is already in the enriched user message. */
  private async discussHighlightInChat(args: {
    chat: ChatOpenAI;
    messages: BaseMessage[];
    excerpt: string;
    userMessage: string;
    signal?: AbortSignal;
  }): Promise<string> {
    const followUp = [
      ...args.messages,
      new HumanMessage(
        [
          "The user highlighted an excerpt (see the focused selection block above). Reply in chat only — explain, critique, or rephrase as they asked.",
          "Do NOT call tools or mention fetching the draft unless they explicitly asked to apply changes to it.",
          `Their message: ${args.userMessage}`,
          "End with one clear next question or offered action.",
        ].join("\n")
      ),
    ];
    try {
      const out = await args.chat.invoke(followUp, { signal: args.signal });
      const text = typeof out.content === "string" ? out.content : JSON.stringify(out.content);
      return (
        text.trim() || "What would you like to do with that passage — discuss it further or apply an edit to the draft?"
      );
    } catch (e) {
      logger.warn("Highlight discussion follow-up failed", { error: (e as Error).message }, "OrchestratorGraphService");
      return "I had trouble responding about that highlight — could you rephrase your question?";
    }
  }

  private async summarizeToolResult(args: {
    chat: ChatOpenAI;
    systemPromptText: string;
    history: BaseMessage[];
    toolName: string;
    toolSummary: string;
    signal?: AbortSignal;
  }): Promise<string> {
    // We deliberately avoid `ToolMessage` here — see buildMessageHistory's
    // H11 comment. The supervisor isn't using OpenAI tool-calls, so a
    // role:"tool" message would be rejected by the API.
    const followUp = [
      ...args.history,
      new AIMessage(`[Tool '${args.toolName}' result] ${args.toolSummary}`),
      new HumanMessage(
        [
          "Reply to the user with a concise, natural-language summary of the tool result above.",
          "Do not request another tool call.",
          "If the tool result contains a URL (e.g. starts with 'Preview:' or 'http'), surface it verbatim as a markdown link so the user can click it.",
          "If the result is empty, suggest one specific next step.",
        ].join(" ")
      ),
    ];
    try {
      const out = await args.chat.invoke(followUp, { signal: args.signal });
      const text = typeof out.content === "string" ? out.content : JSON.stringify(out.content);
      return text.trim() || args.toolSummary;
    } catch (e) {
      logger.warn(
        "Tool summary follow-up failed; falling back to raw tool summary",
        { error: (e as Error).message, tool: args.toolName },
        "OrchestratorGraphService"
      );
      return args.toolSummary;
    }
  }

  /**
   * After blogs.get, immediately re-plan so blogs.update can run in the same user turn.
   * The supervisor only gets one tool per planTurn call; this chains a second plan.
   */
  private async attemptChainedBlogUpdate(args: {
    input: PlanTurnInput;
    messages: BaseMessage[];
    chat: ChatOpenAI;
    systemPromptText: string;
    getInvocation: NonNullable<PlanTurnOutput["tool_invocation"]>;
    getData: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<PlanTurnOutput | null> {
    const blogId = args.input.selectionContext!.blog_id;
    const excerpt = args.input.selectionContext!.text?.trim();
    const contentHtml =
      typeof args.getData.content_html === "string"
        ? args.getData.content_html
        : typeof args.getData.content === "string"
          ? args.getData.content
          : "";

    const chainPrompt = buildContextualSurgicalEditPrompt({
      blogId,
      originalHtml: contentHtml,
      userMessage: args.input.newUserMessage,
      excerpt,
    });

    const chainMessages = [
      ...args.messages,
      new AIMessage(`[Tool 'blogs.get' result] ${args.getInvocation.summary}`),
      new HumanMessage(chainPrompt),
    ];

    const planner = args.chat.withStructuredOutput(supervisorDecisionRawSchema);
    let updateDecision: SupervisorDecision;
    try {
      const raw = await planner.invoke(chainMessages, { signal: args.signal });
      updateDecision = parseSupervisorDecisionFromRaw(raw);
    } catch (e) {
      logger.warn(
        "Chained blogs.update planner failed",
        { error: (e as Error).message, blogId },
        "OrchestratorGraphService"
      );
      return null;
    }

    if (updateDecision.next !== "call_tool" || updateDecision.tool?.name !== "blogs.update") {
      if (updateDecision.next === "respond" && updateDecision.reply?.trim()) {
        return {
          decision: updateDecision,
          prior_tool_invocation: args.getInvocation,
          tool_invocation: null,
          assistant_reply: updateDecision.reply.trim(),
        };
      }
      return null;
    }

    const updateTool = this.toolRegistry.get("blogs.update");
    if (!updateTool) return null;

    const rawUpdateInput = (updateDecision.tool?.input ?? {}) as Record<string, unknown>;
    const updateInput = prepareBlogToolInput("blogs.update", rawUpdateInput, args.input.selectionContext);

    const proposedContent = typeof updateInput.content === "string" ? updateInput.content : "";
    if (proposedContent && excerpt && contentHtml.length > 200) {
      const preservation = assessSurgicalUpdatePreservation(contentHtml, proposedContent, {
        excerpt,
        userMessage: args.input.newUserMessage,
      });
      if (!preservation.ok) {
        return {
          decision: { ...updateDecision, next: "respond", tool: null },
          prior_tool_invocation: args.getInvocation,
          tool_invocation: null,
          assistant_reply: buildConcernedEditReply(preservation.concern ?? "the edit may remove too much of the draft"),
        };
      }
    }

    try {
      const updateResult = await this.tokenEnforcement.runNested(() =>
        updateTool.run({
          siteId: args.input.siteId,
          userId: args.input.userId,
          threadId: args.input.threadId,
          input: updateInput,
        })
      );

      const reply = await this.summarizeToolResult({
        chat: args.chat,
        systemPromptText: args.systemPromptText,
        history: chainMessages,
        toolName: "blogs.update",
        toolSummary: updateResult.summary,
        signal: args.signal,
      });

      return {
        decision: updateDecision,
        prior_tool_invocation: args.getInvocation,
        tool_invocation: {
          name: "blogs.update",
          input: updateInput,
          ok: true,
          summary: updateResult.summary,
          data: updateResult.data,
        },
        assistant_reply: reply,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn("Chained blogs.update errored", { error: errorMessage, blogId }, "OrchestratorGraphService");
      return {
        decision: updateDecision,
        prior_tool_invocation: args.getInvocation,
        tool_invocation: {
          name: "blogs.update",
          input: updateInput,
          ok: false,
          summary: errorMessage,
          error: errorMessage,
        },
        assistant_reply: `I fetched the draft but couldn't save your edits: ${errorMessage}`,
      };
    }
  }

  private fallbackReply(decision: SupervisorDecision): string {
    if (decision.reply && decision.reply.trim()) {
      return decision.reply.trim();
    }
    if (decision.next === "request_confirmation" && decision.confirmation?.summary) {
      return decision.confirmation.summary;
    }
    if (decision.next === "complete_onboarding") {
      return "I have what I need to finish onboarding. I'll mark your workspace ready.";
    }
    if (decision.next === "update_memory") {
      return "I'll update the workspace memory with what you've shared.";
    }
    if (decision.next === "resolve_confirmation") {
      return decision.confirmation_decision?.decision === "approved"
        ? "Confirmed — I'll proceed."
        : "Got it, I won't proceed.";
    }
    return "Got it.";
  }

  private buildContextJson(memory: WorkspaceMemory): string {
    const snapshot = {
      strategic: memory.strategic,
      preferences: memory.preferences,
      operational: {
        publishing_cadence: memory.operational.publishing_cadence,
        approval_rules: memory.operational.approval_rules,
        review_lead_time_hours: memory.operational.review_lead_time_hours,
      },
    };
    return JSON.stringify(snapshot, null, 2).slice(0, 4000);
  }

  private buildMessageHistory(
    systemPrompt: string,
    history: OrchestratorMessage[],
    newUserMessage: string
  ): BaseMessage[] {
    const out: BaseMessage[] = [new SystemMessage(systemPrompt)];
    for (const m of history) {
      switch (m.role) {
        case OrchestratorMessageRole.USER:
          out.push(new HumanMessage(m.content));
          break;
        case OrchestratorMessageRole.ASSISTANT:
          out.push(new AIMessage(m.content));
          break;
        case OrchestratorMessageRole.TOOL: {
          // OpenAI requires `role:"tool"` messages to be paired with an
          // assistant message carrying a `tool_calls` entry that references
          // the same tool_call_id. Our supervisor uses structured output
          // (`withStructuredOutput`) and never emits OpenAI-style tool_calls,
          // so historical tool messages would be orphans and the request
          // 400s with: "messages with role 'tool' must be a response to a
          // preceeding message with 'tool_calls'." (debug session H11).
          //
          // Replay the tool result as plain assistant context instead. The
          // model still sees the prior output; it just isn't pretending the
          // turn was an OpenAI tool-call response.
          const label = m.tool_name ? `Tool '${m.tool_name}' result` : "Tool result";
          out.push(new AIMessage(`[${label}] ${m.content}`));
          break;
        }
        case OrchestratorMessageRole.SYSTEM:
          // Older system messages are merged into the lead system prompt rather
          // than duplicated; skip here.
          break;
      }
    }
    out.push(new HumanMessage(newUserMessage));
    return out;
  }

  private async fetchBlogContentHtml(input: PlanTurnInput, blogId: string): Promise<string> {
    const getTool = this.toolRegistry.get("blogs.get");
    if (!getTool) return "";
    try {
      const got = await this.tokenEnforcement.runNested(() =>
        getTool.run({
          siteId: input.siteId,
          userId: input.userId,
          threadId: input.threadId,
          input: { id: blogId },
        })
      );
      const data = (got.data ?? {}) as Record<string, unknown>;
      if (typeof data.content_html === "string") return data.content_html;
      if (typeof data.content === "string") return data.content;
      return "";
    } catch {
      return "";
    }
  }
}

function prepareBlogToolInput(
  toolName: string,
  raw: Record<string, unknown>,
  selectionContext?: SelectionContextPayload
): Record<string, unknown> {
  if (!toolName.startsWith("blogs.")) return raw;
  let input = normalizeBlogToolInput(raw);
  if (selectionContext?.blog_id && !input.id) {
    input = { ...input, id: selectionContext.blog_id };
  }
  return input;
}
