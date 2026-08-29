export type FramerFieldLike = {
  id: string;
  name: string;
};

const BLOG_FIELD_TOKENS: Record<string, string[]> = {
  title: ["title", "name"],
  content: ["content", "body", "rich"],
  slug: ["slug"],
  excerpt: ["excerpt", "summary", "description"],
  featured_image: ["image", "cover", "thumbnail"],
  published_at: ["published", "date"],
};

const MATCH_ORDER = ["title", "content", "slug", "excerpt", "featured_image", "published_at"] as const;

function fieldMatches(name: string, tokens: string[]): boolean {
  const lower = name.toLowerCase();
  return tokens.some((token) => lower.includes(token));
}

/**
 * Prefill Bloggr → Framer field ids. Existing values (including explicit Skip "") are kept.
 */
export function suggestFramerFieldMap(
  fields: FramerFieldLike[],
  current: Record<string, string> = {}
): Record<string, string> {
  const next = { ...current };
  const used = new Set(Object.values(next).filter(Boolean));

  for (const blogField of MATCH_ORDER) {
    if (next[blogField] !== undefined) continue;
    const tokens = BLOG_FIELD_TOKENS[blogField];
    const match = fields.find((field) => !used.has(field.id) && fieldMatches(field.name, tokens));
    if (!match) continue;
    next[blogField] = match.id;
    used.add(match.id);
  }

  return next;
}
