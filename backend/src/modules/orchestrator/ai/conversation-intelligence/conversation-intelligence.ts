import { injectable } from "tsyringe";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../contracts/conversation-context";
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

function isStorytellingWithoutWorkflow(message: string): boolean {
  return STORYTELLING.test(message) && !EXPLICIT_WORKFLOW.test(message);
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
      }
      return result;
    }

    const raw = analyzeConversationDeterministic(input);
    return conversationContextSchema.parse(raw);
  }
}
