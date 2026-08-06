import type { ConversationContext } from "../../contracts/conversation-context";
import type { Intent } from "../../contracts/enums";
import type { PostFormat } from "../../contracts/post-format";
import {
  FORMAT_CLARIFY_QUESTION,
  SKIP_FORMAT_GATE_RE,
  defaultPostFormatOnSkip,
  isPostFormat,
  narrativeFromRecent,
  parsePostFormat,
  priorAskedFormatClarify,
} from "../../contracts/post-format";

const CREATE =
  /\b(?:write|draft|create|generate|compose)\b.*\b(?:blog|post|article|content)\b|\b(?:blog|post|article)\b.*\b(?:write|draft|create|generate)\b/i;
const SOFT_CREATE =
  /\b(?:we\s+should|probably|maybe\s+we|ought\s+to|might\s+want\s+to)\b.*\b(?:write|draft|post|article|blog|content)\b/i;
const BRAINSTORM = /\b(?:ideas?|brainstorm|topics?\s+could|what\s+should\s+i\s+write|want\s+to\s+write\s+something)\b/i;
const VAGUE_WRITE = /\bi\s+want\s+to\s+write\s+(?:something|about)\b|\bwrite\s+something\s+about\b/i;
const QUICK_DRAFT_PHRASE = /\b(?:quick|rough)\s+draft\b/i;
const EXPLICIT_DRAFT_NOW =
  /\b(?:write\s+it\s+now|create\s+the\s+draft|go\s+ahead(?:\s+and\s+(?:draft|write))?|generate\s+the\s+(?:post|draft|article)|draft\s+it(?:\s+now)?|just\s+draft|just\s+write\s+it|skip\s+(?:the\s+)?(?:discuss(?:ion)?|chat|format|question|picker)|make\s+the\s+draft)\b/i;
const DISCUSS_FIRST =
  /\b(?:discuss|talk\s+(?:it\s+)?through|brainstorm|explore|add\s+more\s+(?:facts?|details?)|let'?s\s+(?:chat|talk)|chat\s+about)\b/i;
const RESEARCH_FIRST =
  /\b(?:research|look\s+(?:it\s+)?up|is\s+(?:this|it|that)\s+real|confirm|fact[\s-]?check|verify|check\s+(?:if|whether))\b/i;

const FEEDBACK =
  /\b(?:boring|robotic|too\s+long|too\s+short|jargon|make\s+(?:it|this)\s+(?:shorter|better|more)|feels?\s+too|flat)\b/i;
/** Rewrite / structural edits to an open draft (section, intro, conclusion, add/remove). */
const SECTION_EDIT =
  /\b(?:rewrite|update|revise|change|improve|spice\s+up|try\s+another\s+approach)\b[\s\S]{0,100}\b(?:intro|introduction|conclusion|section|ending|opening)\b|\b(?:add|remove|delete)\s+(?:a\s+)?section\b|\bonly\s+the\s+(?:conclusion|introduction|intro)\b|\bnew\s+conclusion\b|\bdraft\s+update\b/i;
const PREFERENCE =
  /\b(?:i\s+prefer|from\s+now\s+on|always\s+use|use\s+a\s+more|prefer\s+shorter|conversational\s+tone)\b/i;
const RESEARCH = /\b(?:research|competitors?|sources?)\b/i;
const OPTIMIZE = /\b(?:optimize|seo|improve\s+(?:this|the)\s+(?:article|post|draft)|gao)\b/i;
const CASUAL = /^(?:hi|hello|hey|thanks|thank\s+you|lol|haha|😂|good\s+(?:morning|afternoon|evening))\b/i;
/** Includes contractions like "whats" / "how's" and mid-sentence question words. */
const ASK =
  /\?$|^(?:what|whats|what'?s|how|hows|how'?s|why|when|where|who|whos|who'?s|can\s+you\s+explain|tell\s+me|describe|explain)\b|\b(?:what|whats|what'?s|how|hows|how'?s|why|when|where|who)\b|\btell\s+me\s+about\b/i;
/** Discussion / opinion — never auto-start writing. */
const DISCUSSION =
  /\b(?:what\s+do\s+you\s+think|pros\s+and\s+cons|your\s+thoughts|can\s+you\s+explain|walk\s+me\s+through|help\s+me\s+think)\b/i;
const LIST_POSTS =
  /\b(?:how\s+many\s+posts?|list\s+(?:my\s+|our\s+)?(?:posts?|blogs?)|show\s+(?:me\s+)?(?:my\s+|our\s+)?(?:posts?|blogs?)|posts?\s+(?:do\s+we|we\s+have|have\s+we)|what\s+posts?\s+(?:do\s+we|we\s+have))\b/i;
const ANALYTICS =
  /\b(?:blog\s+stats|post\s+stats|statistics|analytics|how\s+(?:are|is)\s+(?:our|my)\s+posts?\s+doing)\b/i;
const CREATE_CAMPAIGN =
  /\b(?:create|start|launch|set\s+up|setup)\b[\s\S]{0,40}\bcampaign\b|\bnew\s+campaign\b|\bcampaign\s+for\b/i;
const UPDATE_CAMPAIGN =
  /\b(?:update|rename|change|edit|pause|resume|extend)\b[\s\S]{0,40}\bcampaign\b|\bcampaign\b[\s\S]{0,40}\b(?:dates?|goal|audience|frequency)\b/i;
const LEARN_CAMPAIGN =
  /\b(?:how\s+do\s+campaigns?\s+work|explain\s+(?:my\s+|our\s+)?campaigns?|what\s+is\s+a\s+campaign|tell\s+me\s+about\s+(?:my\s+|our\s+)?campaigns?)\b/i;
const CAMPAIGN_PERFORMANCE =
  /\b(?:campaign\s+(?:performance|progress|health|stats|report)|how\s+is\s+(?:my\s+|our\s+)?campaign\s+doing|campaign\s+metrics)\b/i;
const DISCUSS_CAMPAIGN =
  /\b(?:discuss|talk\s+(?:about|through)|brainstorm|explore)\b[\s\S]{0,40}\bcampaign\b|\bcampaign\b[\s\S]{0,40}\b(?:ideas?|angle|direction)\b/i;
const CAMPAIGN_CONTENT =
  /\b(?:content|posts?|blogs?|articles?)\b[\s\S]{0,40}\bcampaign\b|\bcampaign\b[\s\S]{0,40}\b(?:content|posts?|roadmap|calendar)\b/i;
const TONE_OR_BRAND =
  /\b(?:(?:brand|company)\s+tone|tone\s+of\s+(?:the\s+)?(?:company|brand|business)|brand\s+voice|our\s+(?:brand|audience|tone|voice))\b/i;
const FOLLOW_UP = /\bi\s+meant\b|\bi\s+mean\b|\bas\s+in\b|\bthat(?:'s|\s+is)\s+what\s+i\s+meant\b/i;
const GET_POST =
  /\b(?:get|show|open|find)\s+(?:me\s+)?(?:the\s+)?(?:post|blog|article)\b|\b(?:post|blog)\s+(?:titled|called|named)\b/i;
const URGENCY = /\b(?:tomorrow|asap|urgent|client\s+presentation|deadline|by\s+eod)\b/i;
const HUMOR = /\b(?:haha|lol|lmao|😂|🤣|joke)\b/i;
const DOMAIN_TOPIC =
  /\b(?:ai|seo|saas|marketing|onboarding|payroll|remote|agents?|guide|how\s+to|strategy|product|customers?|growth|content|brand)\b/i;
const SPECULATIVE_STORY =
  /\b(?:a\s+(?:man|woman|person|guy|girl|hero|engineer|kid|child)\b|\bwho\s+(?:flew|saved|fixed|invented|discovered)|saved\s+the\s+world|once\s+upon|fictional|made[\s-]up|magical)\b/i;

const THIN_CREATE_CLARIFY_RE = /discuss the angle|confirm whether|quick draft|add more facts|real story/i;

/** Soft typo / phrasing fixes before regex CI. */
function normalizeUserMessage(raw: string): string {
  return raw
    .replace(/\bapost\b/gi, "a post")
    .replace(/\bshave\b/gi, "have")
    .replace(/\btell\s+em\b/gi, "tell me")
    .replace(/\bwrite\.\s*/gi, "write ")
    .replace(/\s+/g, " ")
    .trim();
}

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
  /** Voice/call UI — prefer discuss-before-draft. */
  conversation_mode?: boolean;
};

function extractTopic(message: string): string | undefined {
  const clean = (raw: string) =>
    raw
      .replace(/[.?!]+$/, "")
      .replace(/[“”"']/g, "")
      .trim()
      .slice(0, 500);

  const about = message.match(/\b(?:about|on|regarding)\s+(.+)$/i);
  if (about?.[1]) {
    const t = clean(about[1]);
    if (t && !/^(?:a\s+)?(?:blog|post|article|draft)s?$/i.test(t)) return t;
  }
  const write = message.match(
    /\b(?:write|draft|create|generate)\s+(?:a\s+)?(?:blog|post|article)?\s*(?:about|on)\s+(.+)$/i
  );
  if (write?.[1]) {
    const t = clean(write[1]);
    if (t && !/^(?:that|this|it|them)\b/i.test(t)) return t;
  }
  const soft = message.match(/\b(?:write|post|article|blog)\s+(?:something\s+)?(?:about|on)\s+(.+)$/i);
  if (soft?.[1]) {
    const t = clean(soft[1]);
    if (t && !/^(?:that|this|it|them)\b/i.test(t)) return t;
  }
  const quick = message.match(/\b(?:quick|rough)\s+draft[:\s]+(.+)$/i);
  if (quick?.[1]) {
    const t = clean(quick[1]);
    if (t) return t;
  }
  return undefined;
}

/** Thin / speculative topics should discuss or research before drafting. */
function isThinOrSpeculativeTopic(topic: string): boolean {
  const words = topic.split(/\s+/).filter(Boolean);
  if (SPECULATIVE_STORY.test(topic)) return true;
  if (words.length <= 5 && !DOMAIN_TOPIC.test(topic)) return true;
  return false;
}

function priorAskedThinCreateClarify(recent?: Array<{ role: "user" | "assistant"; content: string }>): boolean {
  const prior = [...(recent ?? [])].reverse().find((m) => m.role === "assistant");
  return Boolean(prior && THIN_CREATE_CLARIFY_RE.test(prior.content));
}

/** Only inherit prior topic when this turn is clearly referential. */
function messageNeedsInheritedTopic(message: string): boolean {
  if (extractTopic(message)) return false;
  return (
    /^(?:just\s+)?(?:research|report)(?:\s+and\s+report)?\s*$/i.test(message) ||
    /\b(?:that|this|it|the\s+same|of\s+that|about\s+that|on\s+that)\b/i.test(message) ||
    /^(?:go\s+ahead|do\s+it|yes|yep|sure)\b/i.test(message)
  );
}

function topicFromRecentMessages(recent?: Array<{ role: "user" | "assistant"; content: string }>): string | undefined {
  for (const m of [...(recent ?? [])].reverse()) {
    if (m.role !== "user") continue;
    const t = normalizeUserMessage(m.content);
    if (!t) continue;
    if (/^(?:just\s+)?research\b|^go\s+ahead\b|^discuss\b/i.test(t)) continue;
    if (LIST_POSTS.test(t) || ANALYTICS.test(t) || GET_POST.test(t)) continue;
    // Skip pure Q&A turns — they are not content topics.
    if (ASK.test(t) && !CREATE.test(t) && !RESEARCH.test(t) && !extractTopic(t)) continue;
    const extracted = extractTopic(t);
    if (extracted) return extracted;
    if (RESEARCH.test(t)) {
      const stripped = t
        .replace(/^(?:please\s+)?(?:do\s+)?(?:research|look\s+up)\s+(?:and\s+report\s+)?(?:on\s+|about\s+)?/i, "")
        .replace(/[.?!]+$/, "")
        .trim()
        .slice(0, 200);
      if (stripped && stripped.length > 2 && stripped.toLowerCase() !== t.toLowerCase()) {
        return stripped;
      }
    }
  }
  return undefined;
}

/**
 * Deterministic CI analyzer (M2). Implements communicative vs literal rules from doc 19.
 * LLM `ci.analyze.v1` can replace/augment this later without changing the public API.
 */
export function analyzeConversationDeterministic(input: ConversationIntelligenceInput): ConversationContext {
  const message = normalizeUserMessage(input.message);
  const ownTopic = extractTopic(message);
  let topic =
    ownTopic ?? (messageNeedsInheritedTopic(message) ? topicFromRecentMessages(input.recent_messages) : undefined);
  const hasDraft = Boolean(input.open_artifacts?.draft_id);
  const humor = HUMOR.test(message);
  const urgency = URGENCY.test(message) ? "high" : "normal";
  const voiceCall = Boolean(input.conversation_mode);
  const awaitingCreatePath = priorAskedThinCreateClarify(input.recent_messages);
  const awaitingFormatPick = priorAskedFormatClarify(input.recent_messages);
  const narrative = narrativeFromRecent(input.recent_messages, message);
  const parsedFormat = parsePostFormat(message);
  const priorFormat = input.prior_context?.slots_patch?.post_format;
  let post_format: PostFormat | undefined =
    parsedFormat ?? (priorFormat && isPostFormat(priorFormat) ? priorFormat : undefined);

  let communicative_category: ConversationContext["communicative_category"] = "unknown";
  let workflow_intent: Intent = "unknown";
  let suggested_next_action: ConversationContext["suggested_next_action"] = "clarify";
  let conversation_mode: ConversationContext["conversation_mode"] = "information";
  let action_required = false;
  let confidence = 0.55;
  let requires_clarification = false;
  let clarification_question: string | undefined;
  let initiative: ConversationContext["response_style"]["initiative"] = "suggest";

  // Format picker reply after editor-gate clarify.
  if (awaitingFormatPick && (parsedFormat || SKIP_FORMAT_GATE_RE.test(message) || EXPLICIT_DRAFT_NOW.test(message))) {
    if (!post_format) {
      post_format = defaultPostFormatOnSkip(narrative);
    }
    if (!topic) {
      topic = topicFromRecentMessages(input.recent_messages);
    }
    communicative_category = "request_action";
    workflow_intent = "create_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "creation";
    action_required = true;
    confidence = 0.93;
    initiative = "lead";
  } else if (CASUAL.test(message) && message.length < 80 && !CREATE.test(message) && !SOFT_CREATE.test(message)) {
    communicative_category = "casual";
    workflow_intent = "casual";
    suggested_next_action = "casual_reply";
    conversation_mode = "casual";
    confidence = 0.9;
    initiative = "passive";
  } else if (LIST_POSTS.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "list_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "information";
    action_required = true;
    confidence = 0.9;
    initiative = "lead";
  } else if (ANALYTICS.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "analytics";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "information";
    action_required = true;
    confidence = 0.88;
    initiative = "lead";
  } else if (CAMPAIGN_PERFORMANCE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "campaign_performance";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "information";
    action_required = true;
    confidence = 0.9;
    initiative = "lead";
  } else if (LEARN_CAMPAIGN.test(message)) {
    communicative_category = "ask_information";
    workflow_intent = "learn_campaign";
    suggested_next_action = "explain";
    conversation_mode = "information";
    confidence = 0.88;
    initiative = "suggest";
  } else if (DISCUSS_CAMPAIGN.test(message) && !CREATE_CAMPAIGN.test(message) && !CREATE.test(message)) {
    communicative_category = "brainstorm";
    workflow_intent = "discuss_campaign";
    suggested_next_action = "clarify";
    conversation_mode = "planning";
    confidence = 0.87;
    initiative = "suggest";
  } else if (CAMPAIGN_CONTENT.test(message) && !CREATE_CAMPAIGN.test(message) && !CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "campaign_content";
    suggested_next_action = "clarify";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.86;
    initiative = "lead";
  } else if (CREATE_CAMPAIGN.test(message) && !CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "create_campaign";
    suggested_next_action = "clarify";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.91;
    initiative = "lead";
  } else if (UPDATE_CAMPAIGN.test(message) && !CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "update_campaign";
    suggested_next_action = "clarify";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.86;
    initiative = "suggest";
  } else if (GET_POST.test(message) && !CREATE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "get_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "information";
    action_required = true;
    confidence = 0.86;
    initiative = "lead";
  } else if (
    (FOLLOW_UP.test(message) || TONE_OR_BRAND.test(message)) &&
    !CREATE.test(message) &&
    !RESEARCH.test(message)
  ) {
    communicative_category = "ask_information";
    workflow_intent = "explain";
    suggested_next_action = "explain";
    conversation_mode = "information";
    confidence = 0.86;
    initiative = "passive";
  } else if (awaitingCreatePath && EXPLICIT_DRAFT_NOW.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "create_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "creation";
    action_required = true;
    confidence = 0.92;
    initiative = "lead";
  } else if (awaitingCreatePath && DISCUSS_FIRST.test(message)) {
    communicative_category = "brainstorm";
    workflow_intent = "strategy";
    suggested_next_action = "start_planning";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.9;
    initiative = "suggest";
  } else if (awaitingCreatePath && RESEARCH_FIRST.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "research";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.9;
    initiative = "lead";
  } else if (PREFERENCE.test(message)) {
    communicative_category = "update_preferences";
    workflow_intent = "update_memory";
    suggested_next_action = "emit_memory_candidate";
    conversation_mode = "feedback";
    confidence = 0.88;
  } else if (hasDraft && (SECTION_EDIT.test(message) || FEEDBACK.test(message))) {
    communicative_category = "provide_feedback";
    workflow_intent = "update_content";
    suggested_next_action = "revise_current_artifact";
    conversation_mode = "editing";
    action_required = true;
    confidence = SECTION_EDIT.test(message) ? 0.92 : 0.86;
    initiative = "lead";
  } else if (RESEARCH.test(message) && TONE_OR_BRAND.test(message) && !CREATE.test(message)) {
    // "research whether our tone is right" → workspace explain, not web research on the question text
    communicative_category = "ask_information";
    workflow_intent = "explain";
    suggested_next_action = "explain";
    conversation_mode = "information";
    confidence = 0.84;
    initiative = "suggest";
  } else if (RESEARCH.test(message) && !CREATE.test(message)) {
    // Before ASK — questions like "Can you research …?" must not become explain.
    communicative_category = "request_action";
    workflow_intent = "research";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.84;
    initiative = "lead";
  } else if (
    (DISCUSSION.test(message) || ASK.test(message)) &&
    !CREATE.test(message) &&
    !SOFT_CREATE.test(message) &&
    !QUICK_DRAFT_PHRASE.test(message)
  ) {
    // Questions / discussion (incl. "whats the time", "How does SEO work?", "what do you think?") → explain.
    communicative_category = "ask_information";
    workflow_intent = "explain";
    suggested_next_action = "explain";
    conversation_mode = "information";
    confidence = 0.88;
    initiative = "passive";
  } else if (OPTIMIZE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "optimize_content";
    suggested_next_action = "revise_current_artifact";
    conversation_mode = "editing";
    action_required = true;
    confidence = 0.85;
    initiative = "lead";
  } else if (VAGUE_WRITE.test(message) && !CREATE.test(message)) {
    // A3: "I want to write something about AI" → brainstorm, not create.
    communicative_category = "brainstorm";
    workflow_intent = "strategy";
    suggested_next_action = "start_planning";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.83;
    initiative = "suggest";
  } else if (SOFT_CREATE.test(message) && !CREATE.test(message) && !QUICK_DRAFT_PHRASE.test(message)) {
    // Soft create ("we should probably write…") → confirm before drafting.
    communicative_category = "brainstorm";
    workflow_intent = "create_content";
    suggested_next_action = "clarify";
    conversation_mode = "planning";
    requires_clarification = true;
    clarification_question = "Want me to draft this, or keep exploring the idea first?";
    action_required = false;
    confidence = 0.82;
    initiative = "suggest";
  } else if (CREATE.test(message) || QUICK_DRAFT_PHRASE.test(message)) {
    communicative_category = "request_action";
    workflow_intent = "create_content";
    suggested_next_action = "start_content_workflow";
    conversation_mode = "creation";
    action_required = true;
    confidence = 0.93;
    initiative = "lead";
    const skipFormatGate =
      QUICK_DRAFT_PHRASE.test(message) || EXPLICIT_DRAFT_NOW.test(message) || SKIP_FORMAT_GATE_RE.test(message);
    if (skipFormatGate && !post_format) {
      post_format = defaultPostFormatOnSkip(narrative);
    }
    if (!topic) {
      requires_clarification = true;
      clarification_question = "What topic should the post cover?";
      suggested_next_action = "clarify";
      action_required = false;
    } else if (!skipFormatGate && !post_format && narrative) {
      // Narrative create: editor-gate format picker before drafting.
      requires_clarification = true;
      clarification_question = FORMAT_CLARIFY_QUESTION;
      suggested_next_action = "clarify";
      action_required = false;
      confidence = 0.9;
      initiative = "suggest";
    } else if (!skipFormatGate && (voiceCall || isThinOrSpeculativeTopic(topic))) {
      // Thin / speculative / voice-call creates: discuss or confirm facts before drafting.
      requires_clarification = true;
      clarification_question = `I can write about “${topic.slice(0, 120)}”, but the brief is light. Want to discuss the angle and add facts first, research whether this is a real story, or go ahead with a quick draft?`;
      suggested_next_action = "clarify";
      action_required = false;
      confidence = 0.86;
      initiative = "suggest";
    }
  } else if (BRAINSTORM.test(message)) {
    communicative_category = "brainstorm";
    workflow_intent = "strategy";
    suggested_next_action = "start_planning";
    conversation_mode = "planning";
    action_required = true;
    confidence = 0.82;
    initiative = "suggest";
  } else if (humor) {
    communicative_category = "casual";
    workflow_intent = "casual";
    suggested_next_action = "casual_reply";
    conversation_mode = "casual";
    confidence = 0.75;
    initiative = "passive";
  }

  const tone_preference =
    urgency === "high" ? "professional" : communicative_category === "casual" ? "friendly" : "professional";

  const result: ConversationContext = {
    communicative_category,
    workflow_intent,
    confidence,
    action_required,
    conversation_mode,
    humor_detected: humor,
    tone_preference,
    urgency,
    entities: topic ? [{ type: "topic", value: topic, confidence: 0.85 }] : [],
    references_previous_context: Boolean(input.prior_context || hasDraft),
    requires_clarification,
    clarification_question,
    suggested_next_action,
    response_style: {
      brevity: urgency === "high" ? "short" : "normal",
      formality: tone_preference === "friendly" ? "casual" : "neutral",
      initiative,
    },
    slots_patch: {
      ...(topic ? { topic } : {}),
      ...(post_format ? { post_format } : {}),
    },
    literal_interpretation: message.slice(0, 200),
    communicative_rationale: `${communicative_category} → ${suggested_next_action}`,
  };

  return result;
}
