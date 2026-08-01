import { injectable } from "tsyringe";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../contracts/conversation-context";
import {
  FORMAT_CLARIFY_QUESTION,
  SKIP_FORMAT_GATE_RE,
  defaultPostFormatOnSkip,
  isPostFormat,
  narrativeFromRecent,
  parsePostFormat,
  priorAskedFormatClarify,
} from "../contracts/post-format";
import {
  analyzeConversationDeterministic,
  type ConversationIntelligenceInput,
} from "./pipeline/analyze-deterministic";
import { analyzeConversationWithLlm } from "./pipeline/analyze-llm";

export type { ConversationIntelligenceInput };

const STORYTELLING =
  /\b(?:i want to talk about|talk about an experience|i was at|so i was|and (?:then|he|she|a)\b|personally i|my experience|let me tell you)\b/i;
const EXPLICIT_WORKFLOW =
  /\b(?:write|draft|generate|create)\b[\s\S]{0,40}\b(?:post|blog|article|draft)\b|\b(?:research|look\s+up)\b/i;
const QUICK_OR_SKIP =
  /\b(?:quick|rough)\s+draft\b/i;

function isStorytellingWithoutWorkflow(message: string): boolean {
  return STORYTELLING.test(message) && !EXPLICIT_WORKFLOW.test(message);
}

/** Enforce format editor-gate when LLM create skips it on narrative turns. */
function applyFormatGateOverride(
  input: ConversationIntelligenceInput,
  llm: ConversationContext,
): ConversationContext {
  const message = input.message;
  const narrative = narrativeFromRecent(input.recent_messages, message);
  const parsed = parsePostFormat(message);
  const prior = llm.slots_patch?.post_format ?? input.prior_context?.slots_patch?.post_format;
  let post_format = parsed ?? (isPostFormat(prior) ? prior : undefined);

  if (priorAskedFormatClarify(input.recent_messages)) {
    if (!post_format && (SKIP_FORMAT_GATE_RE.test(message) || QUICK_OR_SKIP.test(message))) {
      post_format = defaultPostFormatOnSkip(narrative);
    }
    if (post_format) {
      return conversationContextSchema.parse({
        ...llm,
        communicative_category: "request_action",
        workflow_intent: "create_content",
        suggested_next_action: "start_content_workflow",
        action_required: true,
        conversation_mode: "creation",
        requires_clarification: false,
        clarification_question: undefined,
        slots_patch: { ...llm.slots_patch, post_format },
        communicative_rationale: `format_pick_override:${llm.communicative_rationale ?? ""}`,
      });
    }
  }

  if (
    llm.workflow_intent === "create_content" &&
    !llm.requires_clarification &&
    !post_format &&
    narrative &&
    !SKIP_FORMAT_GATE_RE.test(message) &&
    !QUICK_OR_SKIP.test(message)
  ) {
    return conversationContextSchema.parse({
      ...llm,
      requires_clarification: true,
      clarification_question: FORMAT_CLARIFY_QUESTION,
      suggested_next_action: "clarify",
      action_required: false,
      slots_patch: { ...llm.slots_patch },
      communicative_rationale: `format_gate_override:${llm.communicative_rationale ?? ""}`,
    });
  }

  if (post_format && llm.slots_patch?.post_format !== post_format) {
    return conversationContextSchema.parse({
      ...llm,
      slots_patch: { ...llm.slots_patch, post_format },
    });
  }

  return llm;
}

/**
 * Conversation Intelligence facade (doc 19).
 * Interprets only — never invokes Skills/Tools or writes belief Mongo.
 * LLM-primary (ci.analyze.v1); deterministic regex is offline / API-failure fallback.
 */
@injectable()
export class ConversationIntelligenceService {
  async analyze(input: ConversationIntelligenceInput): Promise<ConversationContext> {

    const llm = await analyzeConversationWithLlm(input);
    if (llm) {
      let result = llm;
      // Runtime evidence: storytelling was misclassified as create → "Strategy draft" dumps.
      if (
        isStorytellingWithoutWorkflow(input.message) &&
        (llm.workflow_intent === "create_content" ||
          llm.workflow_intent === "strategy" ||
          llm.suggested_next_action === "start_content_workflow" ||
          llm.suggested_next_action === "start_planning")
      ) {
        result = conversationContextSchema.parse({
          ...llm,
          communicative_category: "ask_information",
          workflow_intent: "explain",
          suggested_next_action: "explain",
          action_required: false,
          conversation_mode: "information",
          requires_clarification: false,
          clarification_question: undefined,
          communicative_rationale: `storytelling_override:${llm.communicative_rationale ?? llm.workflow_intent}`,
        });
      } else {
        result = applyFormatGateOverride(input, result);
      }
      return result;
    }

    const raw = analyzeConversationDeterministic(input);
    return conversationContextSchema.parse(raw);
  }
}
