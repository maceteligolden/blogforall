export const API_LEARN_TOPICS = {
  cors: {
    title: "CORS and browser calls",
    summary:
      "Why the Bloggr public API cannot be called from a visitor’s browser, and how a same-origin proxy solves it.",
  },
  pagination: {
    title: "Pagination",
    summary: "How page, limit, and totalPages work when listing published posts.",
  },
  categories: {
    title: "Categories and filtering",
    summary: "How to list categories and filter published posts by category.",
  },
  "content-types": {
    title: "HTML vs markdown content",
    summary: "How content_type tells you whether to render HTML or markdown on your site.",
  },
  "rate-limits": {
    title: "Rate limits",
    summary: "What to expect when many clients share a workspace API key.",
  },
  errors: {
    title: "Error responses",
    summary: "Common status codes and how to handle missing or unpublished posts.",
  },
  comments: {
    title: "Comments",
    summary: "Comment endpoints are public today and are not gated by API keys.",
  },
  webhooks: {
    title: "Webhooks",
    summary: "Push notifications when a post is published are not available yet.",
  },
} as const;

export type ApiLearnSlug = keyof typeof API_LEARN_TOPICS;

export function isApiLearnSlug(value: string): value is ApiLearnSlug {
  return value in API_LEARN_TOPICS;
}

export const API_LEARN_HREF = (slug: ApiLearnSlug) => `/docs/learn/${slug}`;
