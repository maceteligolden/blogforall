import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import { customersHaveContent } from "../../../shared/types/business-profile";
import { migrateStrategicMemory } from "../../../shared/utils/migrate-strategic-memory";
import { WEBSITE_ONBOARDING_QUESTION, WEBSITE_PROPOSAL_CONFIRM_QUESTION } from "./website-onboarding.helper";

export type OnboardingFieldKey =
  | "business_description"
  | "business_model"
  | "industries"
  | "customers"
  | "brand_voice"
  | "brand_negatives"
  | "competitors"
  | "business_goals"
  | "seo_priorities"
  | "publishing_channels"
  | "tone"
  | "default_word_count"
  /** @deprecated Mapped to business_description for older tests/callers. */
  | "business_type"
  /** @deprecated Prefer customers; kept for label-only completeness. */
  | "target_audience";

const FIELD_ORDER: OnboardingFieldKey[] = [
  "business_description",
  "business_model",
  "industries",
  "customers",
  "brand_voice",
  "brand_negatives",
  "competitors",
  "business_goals",
  "seo_priorities",
  "publishing_channels",
  "tone",
  "default_word_count",
];

/** Asked once when next, but empty does not block "all fields captured". */
const OPTIONAL_FIELDS = new Set<OnboardingFieldKey>([
  "brand_negatives",
  "competitors",
  "seo_priorities",
  "business_model",
  "industries",
  "tone",
  "default_word_count",
]);

const FIELD_QUESTIONS: Record<OnboardingFieldKey, string> = {
  business_description:
    "Describe your business in a short paragraph — what you do, who you serve, and what makes you different?",
  business_model: "Is your business primarily B2B, B2C, C2C, or B2B2C?",
  industries: "Which industries does your business belong to?",
  customers:
    "Describe at least one customer persona: who they are, the pain points you solve for them, and what success looks like?",
  brand_voice:
    "Describe your brand voice in a short paragraph — personality, cadence, and how you want to sound in content?",
  brand_negatives: "What words, tones, or claims should your brand avoid? (Optional — you can say skip.)",
  competitors: "Who are your main competitors? Name them and optionally note how you differ. (Optional — say skip.)",
  business_goals: "What are your top 3–5 business goals for content, in order of priority?",
  seo_priorities: "Any topics or keywords you want to prioritize for SEO? (Optional — you can say skip if none.)",
  publishing_channels:
    "Where will you publish besides this Bloggr workspace — e.g. newsletter, LinkedIn, or other channels?",
  tone: "What tone should drafts use — e.g. professional, casual, witty?",
  default_word_count: "Rough default length for posts? (e.g. 800 words)",
  business_type:
    "Describe your business in a short paragraph — what you do, who you serve, and what makes you different?",
  target_audience: "Who is your primary target audience? Describe at least one specific persona you want to reach.",
};

function isFieldMissing(memory: WorkspaceMemory, key: OnboardingFieldKey): boolean {
  const s = migrateStrategicMemory(memory.strategic);
  const p = memory.preferences;
  switch (key) {
    case "business_description":
    case "business_type":
      return !s.business_description?.trim() && !s.business_type?.trim();
    case "business_model":
      return !s.business_model;
    case "industries":
      return !s.industries.length;
    case "customers":
      return !customersHaveContent(s.customers);
    case "target_audience":
      return (
        !customersHaveContent(s.customers) && (!s.target_audience?.length || s.target_audience.every((a) => !a?.trim()))
      );
    case "brand_voice":
      return !s.brand_voice?.trim();
    case "brand_negatives":
      return !s.brand_negatives?.trim();
    case "competitors":
      return !s.competitors.length;
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

/** Required fields still empty (optional interview fields excluded). */
export function listMissingRequiredOnboardingFields(memory: WorkspaceMemory): OnboardingFieldKey[] {
  return listMissingOnboardingFields(memory).filter((key) => !OPTIONAL_FIELDS.has(key));
}

/**
 * When workspace memory is still empty, advance the interview by counting
 * completed user turns in the thread (each answer ≈ one field).
 */
function resolveNextFieldKey(memory: WorkspaceMemory, history?: OrchestratorMessage[]): OnboardingFieldKey | null {
  const missing = listMissingOnboardingFields(memory);
  if (missing.length === 0) return null;
  if (missing.length < FIELD_ORDER.length) {
    return missing[0];
  }
  const userTurns = history?.filter((m) => m.role === OrchestratorMessageRole.USER).length ?? 0;
  const idx = Math.min(Math.max(userTurns, 0), FIELD_ORDER.length - 1);
  return FIELD_ORDER[idx];
}

/**
 * Next question for start/resume, respecting website-first path state.
 */
export function buildNextOnboardingQuestion(memory: WorkspaceMemory, history?: OrchestratorMessage[]): string | null {
  const path = memory.onboarding_path ?? "unset";

  if (path === "unset") {
    return WEBSITE_ONBOARDING_QUESTION;
  }

  if (path === "primary" && memory.pending_proposal) {
    return WEBSITE_PROPOSAL_CONFIRM_QUESTION;
  }

  // Primary without pending (rejected or failed) falls through to secondary fields.
  const key = resolveNextFieldKey(memory, history);
  return key ? FIELD_QUESTIONS[key] : null;
}

/**
 * Human-readable checklist for the system prompt.
 * Only exposes the single next field to ask — never a list of "ask about these".
 */
export function formatOnboardingProgress(memory: WorkspaceMemory): string {
  const path = memory.onboarding_path ?? "unset";

  if (path === "unset") {
    return [
      "Phase: website gate.",
      `Ask EXACTLY this question: ${WEBSITE_ONBOARDING_QUESTION}`,
      "If they paste a URL, the server will ingest it — do not invent scrape results.",
      "If they say they have no website, the server will switch to the chat interview.",
    ].join("\n");
  }

  if (path === "primary" && memory.pending_proposal) {
    return [
      "Phase: primary path — website profile proposed; awaiting confirmation only.",
      `Ask EXACTLY: ${WEBSITE_PROPOSAL_CONFIRM_QUESTION}`,
      "Do NOT ask follow-up field questions unless they reject the proposal.",
    ].join("\n");
  }

  const missing = listMissingOnboardingFields(memory);
  const requiredMissing = listMissingRequiredOnboardingFields(memory);
  const captured = FIELD_ORDER.filter((k) => !missing.includes(k));
  const lines: string[] = [`Phase: secondary chat interview (path=${path}).`];
  if (captured.length > 0) {
    lines.push(`Captured: ${captured.join(", ")}`);
  }
  if (missing.length > 0 && requiredMissing.length > 0) {
    lines.push(`Ask about this field ONLY next: "${missing[0]}"`);
    lines.push(`Exact question to use: ${FIELD_QUESTIONS[missing[0]]}`);
    lines.push(`Remaining fields after this one: ${missing.length - 1} (do not ask them yet).`);
  } else if (missing.length > 0) {
    lines.push(`Required fields captured. Optional next (user may skip): "${missing[0]}"`);
    lines.push(`Exact question to use: ${FIELD_QUESTIONS[missing[0]]}`);
    lines.push("After optional questions (or skip), summarize and request confirmation to complete onboarding.");
  } else {
    lines.push("All required fields captured — summarize and request confirmation to complete onboarding.");
  }
  return lines.join("\n");
}

const DEAD_END_REPLIES = new Set(["got it.", "got it", "ok.", "okay.", "okay", "thanks.", "thank you."]);

export function countQuestionMarks(reply: string): number {
  return (reply.match(/\?/g) ?? []).length;
}

/** Count how many distinct canned field questions appear in a reply. */
export function countMatchedFieldQuestions(reply: string): number {
  return FIELD_ORDER.filter((key) => reply.includes(FIELD_QUESTIONS[key])).length;
}

/**
 * True when the assistant reply would leave the user with nothing to answer,
 * or asks about more than one field in a single turn.
 */
export function onboardingReplyNeedsFollowUp(reply: string): boolean {
  const t = reply.trim();
  if (!t) return true;
  if (DEAD_END_REPLIES.has(t.toLowerCase())) return true;
  if (t.length < 24 && !t.includes("?")) return true;
  if (!t.includes("?")) return true;
  if (countQuestionMarks(t) > 1) return true;
  if (countMatchedFieldQuestions(t) > 1) return true;
  return false;
}

/** Remove interrogative sentences so we can keep a short acknowledgment only. */
function stripQuestionSentences(text: string): string {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !p.includes("?"));
  return parts.join(" ").trim();
}

function firstSentence(text: string, maxLen = 180): string {
  const m = text.match(/^[^.!?]+[.!]?/);
  const s = (m?.[0] ?? text).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Ensure every onboarding turn ends with exactly one interview question —
 * the next missing field only. Skips repair while awaiting website URL or
 * proposal confirmation (those paths are server-driven).
 */
export function ensureOnboardingInterviewReply(
  reply: string,
  memory: WorkspaceMemory,
  history?: OrchestratorMessage[]
): { reply: string; repaired: boolean; nextField: OnboardingFieldKey | null } {
  const path = memory.onboarding_path ?? "unset";
  if (path === "unset" || (path === "primary" && memory.pending_proposal)) {
    return { reply: reply.trim(), repaired: false, nextField: null };
  }

  const nextField = resolveNextFieldKey(memory, history);
  const nextQ = nextField ? FIELD_QUESTIONS[nextField] : null;
  if (!nextQ) {
    return {
      reply: reply.trim() || "I have everything I need. Shall I finalize your workspace setup?",
      repaired: false,
      nextField: null,
    };
  }

  const trimmed = reply.trim();
  const qMarks = countQuestionMarks(trimmed);
  const otherFieldHits = FIELD_ORDER.filter(
    (key) => key !== nextField && trimmed.includes(FIELD_QUESTIONS[key])
  ).length;
  const isCleanSingle =
    qMarks === 1 && trimmed.includes(nextQ) && otherFieldHits === 0 && !onboardingReplyNeedsFollowUp(trimmed);

  if (isCleanSingle) {
    return { reply: trimmed, repaired: false, nextField };
  }

  const ackRaw = stripQuestionSentences(trimmed);
  const ack = ackRaw && !DEAD_END_REPLIES.has(ackRaw.toLowerCase()) ? firstSentence(ackRaw) : "Thanks for sharing.";

  return {
    reply: `${ack}\n\n${nextQ}`,
    repaired: true,
    nextField,
  };
}

export { FIELD_QUESTIONS, FIELD_ORDER };
