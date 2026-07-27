import type { ConversationContext } from "../../contracts/conversation-context";
import type { Intent } from "../../contracts/enums";

export type ConversationIntelligenceInput = {
  message: string;
  recent_messages?: Array<{ role: "user" | "assistant"; content: string }>;
  conversation_summary?: string;
  memory_views?: Record<string, unknown>;
  open_artifacts?: {
    draft_id?: string;
    research_package_id?: string;
    optimization_report_id?: string;
  };
  prior_context?: ConversationContext;
  workspace_id: string;
  user_id: string;
  thread_id: string;
};

const CREATE =
  /\b(?:write|draft|create|generate|compose)\b.*\b(?:blog|post|article|content)\b|\b(?:blog|post|article)\b.*\b(?:write|draft|create|generate)\b/i;
const SOFT_CREATE =
  /\b(?:we\s+should|probably|maybe\s+we|ought\s+to|might\s+want\s+to)\b.*\b(?:write|draft|post|article|blog|content)\b/i;
const BRAINSTORM =
  /\b(?:ideas?|brainstorm|topics?\s+could|what\s+should\s+i\s+write|want\s+to\s+write\s+something)\b/i;
const FEEDBACK =
  /\b(?:boring|robotic|too\s+long|too\s+short|jargon|make\s+(?:it|this)\s+(?:shorter|better|more)|feels?\s+too)\b/i;
const PREFERENCE =
  /\b(?:i\s+prefer|from\s+now\s+on|always\s+use|use\s+a\s+more|prefer\s+shorter|conversational\s+tone)\b/i;
const RESEARCH = /\b(?:research|competitors?|sources?)\b/i;
const OPTIMIZE = /\b(?:optimize|seo|improve\s+(?:this|the)\s+(?:article|post|draft)|gao)\b/i;
const CASUAL = /^(?:hi|hello|hey|thanks|thank\s+you|lol|haha|😂|good\s+(?:morning|afternoon|evening))\b/i;
const ASK = /\?$|^(?:what|how|why|when|where|who|can\s+you\s+explain)\b/i;
const URGENCY = /\b(?:tomorrow|asap|urgent|client\s+presentation|deadline|by\s+eod)\b/i;
const HUMOR = /\b(?:haha|lol|lmao|😂|🤣|joke)\b/i;

function extractTopic(message: string): string | undefined {
  const about = message.match(/\b(?:about|on|regarding)\s+(.+)$/i);
  if (about?.[1]) {
    const t = about[1].replace(/[.?!]+$/, "").trim().slice(0, 500);
    if (t && !/^(?:a\s+)?(?:blog|post|article|draft)s?$/i.test(t)) return t;
  }
  const write = message.match(
    /\b(?:write|draft|create|generate)\s+(?:a\s+)?(?:blog|post|article)?\s*(?:about|on)\s+(.+)$/i,
  );
  if (write?.[1]) {
    const t = write[1].replace(/[.?!]+$/, "").trim().slice(0, 500);
    if (t) return t;
  }
  const soft = message.match(/\b(?:write|post|article|blog)\s+(?:something\s+)?(?:about|on)\s+(.+)$/i);
  if (soft?.[1]) {
    return soft[1].replace(/[.?!]+$/, "").trim().slice(0, 500);
  }
  return undefined;
}

/**
 * Deterministic CI analyzer (M2). Implements communicative vs literal rules from doc 19.
 * LLM `ci.analyze.v1` can replace/augment this later without changing the public API.
 */
export function analyzeConversationDeterministic(
  input: ConversationIntelligenceInput,
): ConversationContext {
  const message = input.message.trim();
  const topic = extractTopic(message);
  const hasDraft = Boolean(input.open_artifacts?.draft_id);
  const humor = HUMOR.test(message);
  const urgency = URGENCY.test(message) ? "high" : "normal";

  let communicative_category: ConversationContext["communicative_category"] = "unknown";
  let workflow_intent: Intent = "unknown";
  let suggested_next_action: ConversationContext["suggested_next_action"] = "clarify";
  let conversation_mode: ConversationContext["conversation_mode"] = "information";
  let action_required = false;
  let confidence = 0.55;
  let requires_clarification = false;
  let clarification_question: string | undefined;
  let initiative: ConversationContext["response_style"]["initiative"] = "suggest";

  if (CASUAL.test(message) && message.length < 80 && !CREATE.test(message) && !SOFT_CREATE.test(message)) {
    communicative_category = "casual";
    workflow_intent = "casual";
    suggested_next_action = "casual_reply";
    conversation_mode = "casual";
    confidence = 0.9;
    initiative = "passive";
  } else if (PREFERENCE.test(message)) {
    communicative_category = "update_preferences";
    workflow_intent = "update_memory";
    suggested_next_action = "emit_memory_candidate";
    conversation_mode = "feedback";
    confidence = 0.88;
  } else if (hasDraft && FEEDBACK.test(message)) {
    communicative_category = "provide_feedback";
    workflow_intent = "update_content";
    suggested_next_action = "revise_current_artifact";
    conversation_mode = "feedback";
    action_required = true;
    confidence = 0.86;
    initiative = "lead";
  } else if (OPTIMIZE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "optimize_content";
    suggested_next_action = "revise_current_artifact";
    conversation_mode = "editing";
    action_required = true;
    confidence = 0.85;
    initiative = "lead";
  } else if (RESEARCH.test(message) && !CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "research";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.84;
    initiative = "lead";
  } else if (CREATE.test(message) || SOFT_CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "create_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "creation";
    action_required = true;
    confidence = SOFT_CREATE.test(message) ? 0.8 : 0.93;
    initiative = "lead";
    if (!topic) {
      requires_clarification = true;
      clarification_question = "What topic should the post cover?";
      suggested_next_action = "clarify";
      action_required = false;
    }
  } else if (BRAINSTORM.test(message)) {
    communicative_category = "brainstorm";
    workflow_intent = "strategy";
    suggested_next_action = "start_planning";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.82;
    initiative = "suggest";
  } else if (ASK.test(message)) {
    communicative_category = "ask_information";
    workflow_intent = "explain";
    suggested_next_action = "explain";
    conversation_mode = "information";
    confidence = 0.88;
    initiative = "passive";
  } else if (humor) {
    communicative_category = "casual";
    workflow_intent = "casual";
    suggested_next_action = "casual_reply";
    conversation_mode = "casual";
    confidence = 0.75;
    initiative = "passive";
  }

  const tone_preference =
    urgency === "high"
      ? "professional"
      : communicative_category === "casual"
        ? "friendly"
        : "professional";

  return {
    communicative_category,
    workflow_intent,
    confidence,
    action_required,
    conversation_mode,
    humor_detected: humor,
    tone_preference,
    urgency,
    entities: topic
      ? [{ type: "topic", value: topic, confidence: 0.85 }]
      : [],
    references_previous_context: Boolean(input.prior_context || hasDraft),
    requires_clarification,
    clarification_question,
    suggested_next_action,
    response_style: {
      brevity: urgency === "high" ? "short" : "normal",
      formality: tone_preference === "friendly" ? "casual" : "neutral",
      initiative,
    },
    slots_patch: topic ? { topic } : {},
    literal_interpretation: message.slice(0, 200),
    communicative_rationale: `${communicative_category} → ${suggested_next_action}`,
  };
}
