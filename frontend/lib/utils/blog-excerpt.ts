/**
 * Build a plain-text excerpt from HTML body: first `maxWords` words, capped at `maxLength`.
 */
export function deriveExcerptFromContent(
  html: string,
  { maxWords = 40, maxLength = 500 }: { maxWords?: number; maxLength?: number } = {}
): string {
  if (!html || typeof html !== "string") return "";
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean).slice(0, maxWords);
  let out = words.join(" ");
  if (out.length > maxLength) {
    out = out.slice(0, maxLength).trimEnd() + "…";
  }
  return out;
}
