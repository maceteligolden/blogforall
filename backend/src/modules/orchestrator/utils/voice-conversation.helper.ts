import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import type { OperationalSessionMode } from "./turn-context.helper";
import { listMissingOnboardingFields } from "./onboarding-interview.helper";

const EXPLICIT_DRAFT_NOW_RE =
  /\b(?:write\s+it\s+now|create\s+the\s+draft|go\s+ahead\s+and\s+(?:draft|write)|generate\s+the\s+(?:post|draft|article)|draft\s+it\s+now|make\s+the\s+draft|start\s+writing\s+it)\b/i;

const WRITE_TOPIC_RE =
  /\b(?:draft|write|blog\s+post|article|post\s+about|generate\s+(?:a\s+)?(?:post|article|blog)|content\s+for|headline|paragraph)\b/i;

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

/** @deprecated Voice has full parity — always false. Kept for test compatibility. */
export function isOutOfScopeVoiceCommand(_message: string): boolean {
  return false;
}

export function isResearchIntent(message: string): boolean {
  return RESEARCH_INTENT_RE.test(message.trim());
}

export function isDiscussIntent(message: string): boolean {
  return DISCUSS_INTENT_RE.test(message.trim());
}

/** @deprecated Voice has full tool parity — returns empty set (no allowlist filtering). */
export function getVoiceAllowedToolNames(_userMessage: string): Set<string> {
  return new Set();
}

/** @deprecated Always allow — voice parity with text. */
export function isVoiceToolAllowed(_toolName: string, _userMessage: string): boolean {
  return true;
}

/** @deprecated Never decline to text — voice can execute the same tools. */
export function buildVoiceDeclineReply(): string {
  return "Got it — I'll handle that now.";
}

export function buildVoiceConversationInstructions(
  sessionMode: OperationalSessionMode | undefined,
  options: { userMessage: string }
): string {
  const mode = sessionMode ?? "casual";
  const lines = [
    "# Voice call mode (ACTIVE)",
    "",
    "The user is on a live voice call with **full product parity** — same tools as text chat (create, edit, publish, schedule, campaigns, strategy, approvals).",
    "",
    "Reply style:",
    "- 2–4 short sentences max for spoken delivery. One question only when asking.",
    "- No markdown, bullets, or long links unless summarizing a completed draft.",
    "- Sound natural. Never tell them to switch to text chat.",
    "",
    `Session focus (${mode}): still applies to topic emphasis.`,
    "",
  ];

  if (isExplicitDraftNowRequest(options.userMessage)) {
    lines.push(
      "The user asked to create the draft now. Proceed with the writing workflow when topic/angle are clear; ask one clarifying question only if blocked."
    );
  } else if (isWriteTopicRequest(options.userMessage)) {
    lines.push(
      "Writing intent — follow the same guided workflow as text (confirm soft intent if needed, then research/outline checkpoints)."
    );
  } else if (isResearchIntent(options.userMessage)) {
    lines.push("User wants research — run research, then summarize findings briefly in speech.");
  } else if (isDiscussIntent(options.userMessage)) {
    lines.push("User wants to discuss — converse; do not auto-start drafting.");
  } else {
    lines.push(
      "Default: converse, guide, and use any workspace tools needed. Keep spoken replies short; put long content in the results panel."
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
 * Shape assistant replies for TTS during voice calls (length only — no capability declines).
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
