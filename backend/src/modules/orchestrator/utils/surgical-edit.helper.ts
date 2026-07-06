/** Strip HTML to plain text for preservation checks. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const FULL_REWRITE_RE =
  /\b(rewrite (the )?(whole|entire|full) (post|article|draft|blog)|rewrite (this )?(post|article|draft)|start over|from scratch|replace the whole)\b/i;

export function isFullRewriteRequest(message: string): boolean {
  return FULL_REWRITE_RE.test(message.trim());
}

export interface SurgicalUpdateAssessment {
  ok: boolean;
  concern?: string;
}

/**
 * Reject updates that replace the full draft with only the edited excerpt.
 * Log evidence (session 3cad4f): post shrank from ~6924 to ~395 chars.
 */
export function assessSurgicalUpdatePreservation(
  originalHtml: string,
  proposedHtml: string,
  options: { excerpt?: string; userMessage: string }
): SurgicalUpdateAssessment {
  if (isFullRewriteRequest(options.userMessage)) {
    return { ok: true };
  }

  const origLen = originalHtml.trim().length;
  const newLen = proposedHtml.trim().length;
  if (origLen < 200) {
    return { ok: true };
  }

  // Highlight edits should keep most of the original body length.
  const minAllowed = Math.floor(origLen * 0.72);
  if (newLen < minAllowed) {
    return {
      ok: false,
      concern: `this would shrink the draft from about ${origLen.toLocaleString()} to ${newLen.toLocaleString()} characters, which usually means the full post was replaced with only the edited snippet instead of updating it in place`,
    };
  }

  const excerpt = options.excerpt?.trim();
  if (!excerpt || excerpt.length < 12) {
    return { ok: true };
  }

  const origText = htmlToPlainText(originalHtml);
  const newText = htmlToPlainText(proposedHtml);
  const needle = excerpt.slice(0, Math.min(80, excerpt.length));
  const idx = origText.indexOf(needle);
  if (idx < 0) {
    return { ok: true };
  }

  const beforeAnchor = origText.slice(Math.max(0, idx - 120), idx).trim();
  const afterAnchor = origText.slice(idx + excerpt.length, idx + excerpt.length + 120).trim();

  if (beforeAnchor.length >= 50) {
    const probe = beforeAnchor.slice(-50);
    if (!newText.includes(probe)) {
      return {
        ok: false,
        concern: `content before the highlighted section appears to have been removed — the update should keep the full post and only change the focus area (plus nearby transitions if needed)`,
      };
    }
  }

  if (afterAnchor.length >= 50) {
    const probe = afterAnchor.slice(0, 50);
    if (!newText.includes(probe)) {
      return {
        ok: false,
        concern: `content after the highlighted section appears to have been removed — the update should keep the full post and only change the focus area (plus nearby transitions if needed)`,
      };
    }
  }

  return { ok: true };
}

export function buildContextualSurgicalEditPrompt(args: {
  blogId: string;
  originalHtml: string;
  userMessage: string;
  excerpt?: string;
}): string {
  const { blogId, originalHtml, userMessage, excerpt } = args;
  const charCount = originalHtml.length;
  const excerptBlock = excerpt
    ? `Highlighted excerpt (primary edit zone):\n"${excerpt.slice(0, 2000)}"`
    : "No excerpt pinned — apply the user's request while preserving unchanged sections.";

  return [
    `[Current draft body from blogs.get — ${charCount} characters. This is the complete source document.]`,
    originalHtml.slice(0, 12_000),
    "",
    excerptBlock,
    "",
    `User request (apply to draft now): ${userMessage}`,
    "",
    "CONTEXTUAL SURGICAL EDIT — required workflow:",
    `1. Start from the FULL draft HTML above. blogs.update "content" MUST be the COMPLETE post (~${charCount} chars, adjusted only where you edit), NEVER just the rewritten highlight.`,
    "2. Primary edit zone: the highlighted excerpt. Rephrase or revise it per the user's prompt.",
    "3. You MAY also adjust the immediately adjacent sentence(s) or paragraph(s) if needed so the passage still flows and the post keeps its goal — do NOT rewrite unrelated sections.",
    "4. All content outside the edit zone must stay substantively the same (facts, structure, headings, order).",
    "5. If the request would hurt clarity, tone, accuracy, or the post's goal, do NOT call blogs.update — respond with your concern and ask whether to apply anyway.",
    `6. When ready to save, call blogs.update with id "${blogId}" and the full updated HTML in "content".`,
  ].join("\n");
}

export function buildConcernedEditReply(concern: string): string {
  return `I'd pause before saving this change — ${concern} Would you like me to apply it anyway, try a lighter edit, or discuss alternatives first?`;
}
