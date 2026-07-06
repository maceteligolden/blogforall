import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import { listMissingOnboardingFields } from "./onboarding-interview.helper";

export interface SelectionContextPayload {
  blog_id: string;
  reference_type?: "highlight" | "blog";
  text?: string;
}

const DEAD_END_ACK_RE = /^(okay|ok|got it|sure|sounds good|understood|will do|done|alright|noted|perfect|great)[.!]?$/i;

function endsWithQuestion(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith("?") || /\?\s*$/.test(trimmed);
}

function isDeadEndAcknowledgment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (DEAD_END_ACK_RE.test(trimmed)) return true;
  // Very short non-question replies that don't invite continuation
  if (trimmed.length < 50 && !endsWithQuestion(trimmed) && !trimmed.includes("—") && !trimmed.includes("–")) {
    return true;
  }
  return false;
}

export function buildHighlightContextBlock(ctx: SelectionContextPayload): string {
  const excerpt = ctx.text?.trim().slice(0, 4000) ?? "";
  if (!excerpt) return "";

  return `[FOCUSED SELECTION — blog ${ctx.blog_id}]
The user pinned this excerpt for ongoing discussion. Treat it as the primary subject of this turn and every subsequent turn until they clear the focus chip.

Excerpt:
"${excerpt}"

Rules:
1. DISCUSSION (default): Explain, critique, compare alternatives, or rephrase in chat. Stay anchored to this excerpt. Do NOT call blogs.update unless the user explicitly asks to apply, save, replace, rewrite, or update the draft.
2. CONTEXTUAL SURGICAL REWRITE (only when the user asks to edit/update/rewrite/change/fix in the draft):
   - Call blogs.get with id "${ctx.blog_id}" to load the FULL post.
   - Primary edit zone: the highlighted excerpt — rephrase or revise it per the user's prompt.
   - You MAY also lightly adjust the immediately adjacent sentence(s) or paragraph(s) if needed so transitions still read naturally and the post keeps its goal. Do NOT rewrite unrelated sections.
   - blogs.update MUST send the COMPLETE post HTML in "content" (full length preserved except your edit zone), never only the rewritten snippet.
   - If the request would hurt clarity, tone, or the post's goal, respond with your concern and ask whether to apply anyway — do NOT call blogs.update until they confirm.
3. Continue the conversation: never end with dead-end acknowledgments alone ("Okay", "Got it"). Always add a purposeful next step or question.`;
}

export function buildSelectionFocusSystemInstructions(ctx: SelectionContextPayload): string {
  const refType = ctx.reference_type ?? "highlight";
  if (refType === "blog") {
    return `# Draft reference (pinned)
The user is referencing blog post ${ctx.blog_id} as ongoing context. Use blogs.get with id "${ctx.blog_id}" before edits. When updating, call blogs.update with id "${ctx.blog_id}". Preserve content they did not ask to change. Keep the conversation moving with a clear next question or offered action.`;
  }
  if (!ctx.text?.trim()) return "";
  return `# Focused text selection (pinned)
The user highlighted a specific passage in blog ${ctx.blog_id} and may continue discussing it across multiple turns.

Default: discuss the excerpt (explain, rephrase in chat, brainstorm).
When they ask to apply changes to the draft:
- Load the full post via blogs.get (id "${ctx.blog_id}").
- Edit the highlighted passage in place; lightly adjust adjacent lines only if needed for flow.
- blogs.update (id "${ctx.blog_id}") must include the COMPLETE post body — never submit only the rewritten highlight.
- If the edit seems wrong for the post's goal or tone, share your concern and ask whether to proceed before calling blogs.update.
Never acknowledge with only "Okay" / "Got it" — follow with "Got it — …" plus a question or suggested action.`;
}

const DRAFT_APPLY_REQUEST_RE =
  /\b(rewrite|re-write|update|apply|replace|change|fix|edit|revise|improve|polish|tighten|shorten|expand|rephrase)\b/i;

/** True when the user is asking to persist edits to the open draft (not just discuss in chat). */
export function isDraftApplyRequest(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  return DRAFT_APPLY_REQUEST_RE.test(trimmed);
}

export function pickSelectionFocusFollowUp(snippet?: string): string {
  const short = snippet?.trim().slice(0, 60);
  if (short) {
    return `What would you like to do with "${short}${snippet && snippet.length > 60 ? "…" : ""}" — explain it, rephrase in chat, or apply an edit to the draft?`;
  }
  return "What would you like to do next — explain this section, rephrase it, or update the draft?";
}

function pickCasualFollowUp(memory: WorkspaceMemory): string {
  const missing = listMissingOnboardingFields(memory);
  if (missing.includes("target_audience")) return "Who is your primary target audience?";
  if (missing.includes("brand_voice"))
    return "How should your content sound — formal, playful, expert, or something else?";
  if (missing.includes("business_goals")) return "What are your top goals for content right now?";
  return "What's the main goal you're working toward with your content right now?";
}

/**
 * Repair short or dead-end assistant replies so the user always has a clear next step.
 */
export function ensureConversationContinuation(
  reply: string | null | undefined,
  options: {
    hasSelectionFocus?: boolean;
    selectionSnippet?: string;
    memory?: WorkspaceMemory;
  }
): { reply: string; repaired: boolean } {
  const text = (reply ?? "").trim();
  if (!text) {
    const followUp = options.hasSelectionFocus
      ? pickSelectionFocusFollowUp(options.selectionSnippet)
      : options.memory
        ? pickCasualFollowUp(options.memory)
        : "What would you like to work on next?";
    return { reply: followUp, repaired: true };
  }

  if (endsWithQuestion(text) && !isDeadEndAcknowledgment(text)) {
    return { reply: text, repaired: false };
  }

  if (isDeadEndAcknowledgment(text)) {
    const followUp = options.hasSelectionFocus
      ? pickSelectionFocusFollowUp(options.selectionSnippet)
      : options.memory
        ? pickCasualFollowUp(options.memory)
        : "What should we tackle next?";
    const prefix = DEAD_END_ACK_RE.test(text) ? `Got it — ` : `${text.replace(/[.!]$/, "")} — `;
    return { reply: `${prefix}${followUp}`, repaired: true };
  }

  if (text.length < 80 && !endsWithQuestion(text)) {
    const followUp = options.hasSelectionFocus
      ? pickSelectionFocusFollowUp(options.selectionSnippet)
      : options.memory
        ? pickCasualFollowUp(options.memory)
        : "What would you like to do next?";
    return { reply: `${text}\n\n${followUp}`, repaired: true };
  }

  return { reply: text, repaired: false };
}
