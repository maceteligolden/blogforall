import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import type { OperationalSessionMode } from "./turn-context.helper";
import { listMissingOnboardingFields } from "./onboarding-interview.helper";

const EXPLICIT_DRAFT_NOW_RE =
  /\b(?:write\s+it\s+now|create\s+the\s+draft|go\s+ahead\s+and\s+(?:draft|write)|generate\s+the\s+(?:post|draft|article)|draft\s+it\s+now|make\s+the\s+draft|start\s+writing\s+it)\b/i;

const WRITE_TOPIC_RE =
  /\b(?:draft|write|blog\s+post|article|post\s+about|generate\s+(?:a\s+)?(?:post|article|blog)|content\s+for|headline|paragraph)\b/i;

const OUT_OF_SCOPE_RE =
  /\b(?:publish|unpublish|schedule|reschedule|delete|remove\s+post|cancel\s+schedule|launch\s+campaign|create\s+campaign|category|categories|assign\s+category|duplicate\s+post|roadmap)\b/i;

const RESEARCH_INTENT_RE =
  /\b(?:research|look\s+online|search\s+the\s+web|what(?:'s|\s+is)\s+online|find\s+out|look\s+up)\b/i;

const DISCUSS_INTENT_RE = /\b(?:discuss|talk\s+through|brainstorm|explore|let(?:'s|\s+us)\s+discuss|chat\s+about)\b/i;

/** User explicitly asks to create the draft now (after prior discussion). */
export function isExplicitDraftNowRequest(message: string): boolean {
  return EXPLICIT_DRAFT_NOW_RE.test(message.trim());
}

/** Broad write/draft intent without explicit go-ahead. */
export function isWriteTopicRequest(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isExplicitDraftNowRequest(text)) return false;
  return WRITE_TOPIC_RE.test(text);
}

/** Commands that cannot run during a voice call (v1). */
export function isOutOfScopeVoiceCommand(message: string): boolean {
  return OUT_OF_SCOPE_RE.test(message.trim());
}

export function isResearchIntent(message: string): boolean {
  return RESEARCH_INTENT_RE.test(message.trim());
}

export function isDiscussIntent(message: string): boolean {
  return DISCUSS_INTENT_RE.test(message.trim());
}

const VOICE_BASE_TOOLS = new Set(["search.web", "workspace.updateMemory"]);

/** Tool names the supervisor may call during a voice conversation turn. */
export function getVoiceAllowedToolNames(userMessage: string): Set<string> {
  const allowed = new Set(VOICE_BASE_TOOLS);
  if (isExplicitDraftNowRequest(userMessage)) {
    allowed.add("blogs.generateDraft");
    allowed.add("blogs.get");
  }
  return allowed;
}

export function isVoiceToolAllowed(toolName: string, userMessage: string): boolean {
  return getVoiceAllowedToolNames(userMessage).has(toolName);
}

export function buildVoiceDeclineReply(): string {
  return "I can't do that on a voice call yet. End the call and continue in text chat, and I'll take care of it there.";
}

export function buildVoiceConversationInstructions(
  sessionMode: OperationalSessionMode | undefined,
  options: { userMessage: string }
): string {
  const mode = sessionMode ?? "casual";
  const lines = [
    "# Voice call mode (ACTIVE)",
    "",
    "The user is on a live voice call. Behave like a thoughtful collaborator on the phone — not a task runner.",
    "",
    "Reply style:",
    "- 2–4 short sentences max. One question only. No markdown, bullets, or links unless drafting just completed.",
    "- Sound natural and curious. Probe before executing.",
    "",
    `Session focus (${mode}): still applies to topic emphasis, but voice rules override aggressive tool use.`,
    "",
  ];

  if (isOutOfScopeVoiceCommand(options.userMessage)) {
    lines.push(
      "The user's latest message requests an action outside voice-call scope. Respond with next: respond only — politely decline and suggest ending the call for text chat. Do NOT call tools."
    );
  } else if (isExplicitDraftNowRequest(options.userMessage)) {
    lines.push(
      "The user asked to create the draft now. If the topic and angle are clear from the conversation, you MAY call blogs.generateDraft once. If critical details are missing, ask one clarifying question first. Summarize briefly after — no long lists."
    );
  } else if (isWriteTopicRequest(options.userMessage)) {
    lines.push(
      "The user mentioned writing content but has NOT asked to draft yet. Do NOT call blogs.generateDraft. Offer two paths: discuss the topic together, or research what's online (search.web). Ask which they prefer in one question."
    );
  } else if (isResearchIntent(options.userMessage)) {
    lines.push(
      "User wants online research. Call search.web with a focused query, then summarize findings in plain speech and ask one follow-up question."
    );
  } else if (isDiscussIntent(options.userMessage)) {
    lines.push(
      "User wants to discuss. Ask one probing question about their angle, audience fit, or opinion. Build on their last statement; do not call draft tools."
    );
  } else {
    lines.push(
      "Default: converse and probe. Use search.web only when they ask to research. Use blogs.generateDraft only after they explicitly say to write/create the draft now.",
      "Blocked on voice calls: publish, schedule, delete, categories, campaigns, and other execution tools — decline and suggest text chat."
    );
  }

  return lines.join("\n");
}

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_`~]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function endsWithQuestion(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith("?") || /\?\s*$/.test(trimmed);
}

function pickProbingQuestion(memory: WorkspaceMemory, userMessage: string): string {
  const missing = listMissingOnboardingFields(memory);
  if (missing.includes("target_audience")) {
    return "Who do you want to reach with this piece?";
  }
  if (missing.includes("brand_voice")) {
    return "How should it sound — expert, casual, or something else?";
  }
  if (userMessage.trim().length > 20) {
    return "What's your main takeaway for readers on this?";
  }
  return "What angle matters most to you here?";
}

/**
 * Shape assistant replies for TTS during voice calls.
 */
export function ensureVoiceConversationReply(
  reply: string | null | undefined,
  options: { memory?: WorkspaceMemory; userMessage?: string }
): { reply: string; repaired: boolean } {
  let text = stripMarkdownForSpeech(reply ?? "");
  if (!text) {
    const fallback = options.memory
      ? pickProbingQuestion(options.memory, options.userMessage ?? "")
      : "What would you like to explore next?";
    return { reply: fallback, repaired: true };
  }

  // Cap length for spoken delivery (~300 chars), prefer keeping the last question
  const MAX = 320;
  if (text.length > MAX) {
    const qIdx = text.lastIndexOf("?");
    if (qIdx > 80) {
      const start = Math.max(0, qIdx - 260);
      text = (start > 0 ? "…" : "") + text.slice(start, qIdx + 1).trim();
    } else {
      text = `${text.slice(0, MAX - 1).trim()}…`;
    }
  }

  if (!endsWithQuestion(text) && text.length < 200) {
    const followUp = options.memory
      ? pickProbingQuestion(options.memory, options.userMessage ?? "")
      : "What should we dig into next?";
    return { reply: `${text} ${followUp}`, repaired: true };
  }

  return { reply: text, repaired: false };
}
