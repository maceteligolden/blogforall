import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";

export type OnboardingFieldKey =
  | "business_type"
  | "target_audience"
  | "brand_voice"
  | "business_goals"
  | "seo_priorities"
  | "publishing_channels"
  | "tone"
  | "default_word_count";

const FIELD_ORDER: OnboardingFieldKey[] = [
  "business_type",
  "target_audience",
  "brand_voice",
  "business_goals",
  "seo_priorities",
  "publishing_channels",
  "tone",
  "default_word_count",
];

const FIELD_QUESTIONS: Record<OnboardingFieldKey, string> = {
  business_type: "What does your business do, in one sentence?",
  target_audience:
    "Who is your primary target audience? Describe at least one specific persona you want to reach.",
  brand_voice:
    "How should your content sound — formal, playful, expert, or something else?",
  business_goals: "What are your top 3–5 business goals for content? List them in order of priority.",
  seo_priorities:
    "Any topics or keywords you want to prioritize for SEO? (Optional — you can say skip if none.)",
  publishing_channels:
    "Where will you publish besides this Bloggr workspace — e.g. newsletter, LinkedIn, or other channels?",
  tone: "What tone should drafts use — e.g. professional, casual, witty?",
  default_word_count: "Rough default length for posts? (e.g. 800 words)",
};

function isFieldMissing(memory: WorkspaceMemory, key: OnboardingFieldKey): boolean {
  const s = memory.strategic;
  const p = memory.preferences;
  switch (key) {
    case "business_type":
      return !s.business_type?.trim();
    case "target_audience":
      return !s.target_audience?.length || s.target_audience.every((a) => !a?.trim());
    case "brand_voice":
      return !s.brand_voice?.trim();
    case "business_goals":
      return !s.business_goals?.length || s.business_goals.every((g) => !g?.trim());
    case "seo_priorities":
      return !s.seo_priorities?.length;
    case "publishing_channels":
      return !s.publishing_channels?.length;
    case "tone":
      return !p.tone?.trim();
    case "default_word_count":
      return p.default_word_count == null || p.default_word_count < 300;
    default:
      return true;
  }
}

/** Ordered list of onboarding fields still empty in workspace memory. */
export function listMissingOnboardingFields(memory: WorkspaceMemory): OnboardingFieldKey[] {
  return FIELD_ORDER.filter((key) => isFieldMissing(memory, key));
}

/**
 * When workspace memory is still empty, advance the interview by counting
 * completed user turns in the thread (each answer ≈ one field).
 */
function resolveNextFieldKey(
  memory: WorkspaceMemory,
  history?: OrchestratorMessage[]
): OnboardingFieldKey | null {
  const missing = listMissingOnboardingFields(memory);
  if (missing.length === 0) return null;
  if (missing.length < FIELD_ORDER.length) {
    return missing[0];
  }
  const userTurns =
    history?.filter((m) => m.role === OrchestratorMessageRole.USER).length ?? 0;
  const idx = Math.min(Math.max(userTurns, 0), FIELD_ORDER.length - 1);
  return FIELD_ORDER[idx];
}

export function buildNextOnboardingQuestion(
  memory: WorkspaceMemory,
  history?: OrchestratorMessage[]
): string | null {
  const key = resolveNextFieldKey(memory, history);
  return key ? FIELD_QUESTIONS[key] : null;
}

/** Human-readable checklist for the system prompt. */
export function formatOnboardingProgress(memory: WorkspaceMemory): string {
  const missing = listMissingOnboardingFields(memory);
  const captured = FIELD_ORDER.filter((k) => !missing.includes(k));
  const lines: string[] = [];
  if (captured.length > 0) {
    lines.push(`Captured: ${captured.join(", ")}`);
  }
  if (missing.length > 0) {
    lines.push(`Still needed (ask about "${missing[0]}" next): ${missing.join(", ")}`);
  } else {
    lines.push("All required fields captured — summarize and request confirmation to complete onboarding.");
  }
  return lines.join("\n");
}

const DEAD_END_REPLIES = new Set(["got it.", "got it", "ok.", "okay.", "okay", "thanks.", "thank you."]);

/**
 * True when the assistant reply would leave the user with nothing to answer.
 */
export function onboardingReplyNeedsFollowUp(reply: string): boolean {
  const t = reply.trim();
  if (!t) return true;
  if (DEAD_END_REPLIES.has(t.toLowerCase())) return true;
  if (t.length < 24 && !t.includes("?")) return true;
  if (!t.includes("?")) return true;
  return false;
}

/**
 * Ensure every onboarding turn ends with the next interview question.
 */
export function ensureOnboardingInterviewReply(
  reply: string,
  memory: WorkspaceMemory,
  history?: OrchestratorMessage[]
): { reply: string; repaired: boolean; nextField: OnboardingFieldKey | null } {
  const nextField = resolveNextFieldKey(memory, history);
  const nextQ = nextField ? FIELD_QUESTIONS[nextField] : null;
  if (!nextQ) {
    return { reply: reply.trim() || "I have everything I need. Shall I finalize your workspace setup?", repaired: false, nextField: null };
  }

  const trimmed = reply.trim();
  if (!onboardingReplyNeedsFollowUp(trimmed)) {
    return { reply: trimmed, repaired: false, nextField };
  }

  if (!trimmed || DEAD_END_REPLIES.has(trimmed.toLowerCase())) {
    return {
      reply: `Thanks for sharing. ${nextQ}`,
      repaired: true,
      nextField,
    };
  }

  return {
    reply: `${trimmed}\n\n${nextQ}`,
    repaired: true,
    nextField,
  };
}
