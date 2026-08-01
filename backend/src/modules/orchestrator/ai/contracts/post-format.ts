import { z } from "zod";

export const POST_FORMATS = ["personal_story", "engineering_reflection", "productivity", "linkedin_post"] as const;

export const postFormatSchema = z.enum(POST_FORMATS);
export type PostFormat = z.infer<typeof postFormatSchema>;

export const FORMAT_CLARIFY_QUESTION =
  "There's a real story here. Want this as: a personal story, an engineering reflection, a productivity article, or a LinkedIn post?";

export const FORMAT_CLARIFY_RE =
  /personal story|engineering reflection|productivity article|linkedin post|want this as/i;

/** Explicit skip of the format gate → draft immediately. */
export const SKIP_FORMAT_GATE_RE =
  /\b(?:just\s+write\s+it|write\s+it\s+now|draft\s+it(?:\s+now)?|quick\s+draft|rough\s+draft|go\s+ahead(?:\s+and\s+(?:draft|write))?|skip\s+(?:the\s+)?(?:format|question|picker))\b/i;

const NARRATIVE_SIGNAL =
  /\b(?:i\s+(?:was|rode|went|met|felt|thought|told|saw|heard)|today\s+i|yesterday\s+i|my\s+(?:friend|bike|ride|experience)|cycling|bike\s+ride|rode\s+(?:home|back)|weaving\s+through|experience|anecdote|let me tell you|so i was|personally i|talk about an? experience)\b/i;

export function isPostFormat(value: unknown): value is PostFormat {
  return typeof value === "string" && (POST_FORMATS as readonly string[]).includes(value);
}

/** Parse a user reply into a post format when they pick one. */
export function parsePostFormat(message: string): PostFormat | undefined {
  const m = message.toLowerCase();
  if (/\blinkedin\b/.test(m)) return "linkedin_post";
  if (/\bengineering\s+reflection\b/.test(m)) return "engineering_reflection";
  if (/\bproductivity\b/.test(m)) return "productivity";
  if (/\bpersonal\s+story\b/.test(m)) return "personal_story";
  // Short picks after the format question (e.g. "personal", "story", "engineering")
  if (/^(?:personal|story|a\s+story)\b/.test(m.trim())) return "personal_story";
  if (/^(?:engineering|reflection)\b/.test(m.trim())) return "engineering_reflection";
  return undefined;
}

export function isNarrativeShaped(text: string): boolean {
  return NARRATIVE_SIGNAL.test(text);
}

export function narrativeFromRecent(
  recent?: Array<{ role: "user" | "assistant"; content: string }>,
  currentMessage?: string
): boolean {
  if (currentMessage && isNarrativeShaped(currentMessage)) return true;
  for (const m of [...(recent ?? [])].reverse().slice(0, 8)) {
    if (m.role === "user" && isNarrativeShaped(m.content)) return true;
  }
  return false;
}

export function priorAskedFormatClarify(recent?: Array<{ role: "user" | "assistant"; content: string }>): boolean {
  const prior = [...(recent ?? [])].reverse().find((m) => m.role === "assistant");
  return Boolean(prior && FORMAT_CLARIFY_RE.test(prior.content));
}

export function skipsHowToResearch(format?: PostFormat | string): boolean {
  return format === "personal_story" || format === "linkedin_post";
}

export function isPersonalVoiceFormat(format?: PostFormat | string): boolean {
  return format === "personal_story" || format === "linkedin_post";
}

export function defaultPostFormatOnSkip(narrative: boolean): PostFormat {
  return narrative ? "personal_story" : "productivity";
}

export type GenreStrategyDefaults = {
  content_angle: string;
  content_structure: string[];
  keyword_clusters: string[][];
  topical_authority_opportunities: string[];
  cta: string;
};

export function strategyDefaultsForFormat(topic: string, audience: string, format?: PostFormat): GenreStrategyDefaults {
  switch (format) {
    case "personal_story":
      return {
        content_angle: `First-person lived narrative about ${topic} — concrete scenes, honest voice; no forced takeaway`,
        content_structure: [
          "Opening scene in the user's words",
          "What happened next (tension / detail)",
          "Honest close — leave ambiguity if the user left it unresolved",
        ],
        keyword_clusters: [[topic], [`${topic} story`]],
        topical_authority_opportunities: [
          `Stay faithful to what the user actually said about ${topic}`,
          `Preserve confusion or unresolved feelings rather than inventing morals`,
        ],
        cta: "No hard CTA — end where the story naturally ends.",
      };
    case "engineering_reflection":
      return {
        content_angle: `Personal story about ${topic}, then reflection only where the user stated a lesson — otherwise leave ambiguity`,
        content_structure: [
          "Lived scene",
          "What was unclear or surprising",
          "Reflection only if the user stated it",
          "Soft close without invented morals",
        ],
        keyword_clusters: [[topic, `${topic} reflection`], [`${topic} lessons`]],
        topical_authority_opportunities: [
          `Separate scene from interpretation`,
          `Do not invent engineering metaphors the user did not make`,
        ],
        cta: "Invite the reader to sit with the question — no consult pitch.",
      };
    case "linkedin_post":
      return {
        content_angle: `Short, punchy first-person LinkedIn-style take on ${topic}`,
        content_structure: [
          "Hook in the user's voice",
          "1–2 concrete beats from what they said",
          "One honest line — soft CTA optional",
        ],
        keyword_clusters: [[topic], [`${topic} linkedin`]],
        topical_authority_opportunities: [`Keep it scannable and personal`],
        cta: "Optional soft CTA (comment / share) — never a sales pitch.",
      };
    case "productivity":
    default:
      return {
        content_angle: `Practical, evidence-backed take on ${topic} for ${audience}`,
        content_structure: [
          "Hook + problem framing",
          "Key concepts / definitions",
          "Practical steps or framework",
          "Examples and pitfalls",
          "CTA / next action",
        ],
        keyword_clusters: [
          [topic, `${topic} guide`, `${topic} best practices`],
          [`how to ${topic}`, `${topic} examples`],
        ],
        topical_authority_opportunities: [
          `Define core concepts for ${topic}`,
          `Compare common approaches`,
          `Share implementation pitfalls`,
        ],
        cta: "Invite readers to apply one next step or book a consult.",
      };
  }
}

/** Grounded writing instructions injected above the user's lived words. */
export function buildGroundedWritingInstructions(format?: PostFormat | string): string {
  const formatLine = format
    ? `Post format: ${format}. Write for that format only.`
    : "Post format: unspecified — prefer the user's lived voice over expert how-to framing.";

  return `${formatLine}

Write from the user's lived perspective using ONLY what they described below.
Do not invent events, quotes, people, metaphors, morals, philosophical lessons, or causes they did not state.
If a phrase is unclear or nonsense-sounding, preserve the confusion or omit it — never invent profundity from it.
Do not force a professional domain framing (e.g. engineering) unless the post format asks for it.
If they expressed confusion, conflict, or an unresolved feeling, make that a central beat — do not smooth it away.
Prefer their diction, short concrete scenes, and authentic voice over generic AI filler ("the field is constantly evolving", "engineers must adapt", etc.).`;
}

export function buildGroundedWritingPrompt(opts: {
  topic: string;
  userNarrative: string;
  format?: PostFormat | string;
}): string {
  if (!opts.userNarrative.trim()) return opts.topic;
  return `${opts.topic}

${buildGroundedWritingInstructions(opts.format)}

User's words:
${opts.userNarrative}`;
}
