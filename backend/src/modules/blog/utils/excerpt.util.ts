/** Matches MongoDB `excerpt` maxlength in blog.schema.ts */
export const BLOG_EXCERPT_MAX_LENGTH = 500;

/**
 * Truncate excerpt to schema-safe length, breaking on a word boundary when possible.
 */
export function clampBlogExcerpt(
  excerpt: string | undefined | null,
  maxLength: number = BLOG_EXCERPT_MAX_LENGTH
): string {
  if (!excerpt?.trim()) return "";
  const trimmed = excerpt.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const ellipsis = "…";
  const budget = maxLength - ellipsis.length;
  const truncated = trimmed.slice(0, budget);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > budget * 0.6 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trimEnd()}${ellipsis}`;
}
