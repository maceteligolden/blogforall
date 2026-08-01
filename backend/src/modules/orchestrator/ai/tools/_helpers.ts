import { z, type ZodTypeAny } from "zod";
import { BadRequestError, NotFoundError } from "../../../../shared/errors";
import type { CampaignRepository } from "../../../campaign/repositories/campaign.repository";
import type { BlogService } from "../../../blog/services/blog.service";
import type { Blog } from "../../../../shared/schemas/blog.schema";
import { CampaignLifecycleStatus, CampaignStatus } from "../../../../shared/constants/campaign.constant";

/** Map common LLM key aliases to blog tool schemas (`id` is canonical). */
export function normalizeBlogToolInput(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  const keyAliases: Array<[string, string]> = [
    ["blog_id", "id"],
    ["post_id", "id"],
    ["postId", "id"],
    ["blogId", "id"],
    // Topic/idea phrases from the user message → title hint for resolveBlogForTool
    ["query", "title"],
    ["topic", "title"],
  ];
  for (const [from, to] of keyAliases) {
    if (from in out && !(to in out)) {
      out[to] = out[from];
      delete out[from];
    }
  }
  return out;
}

export type ResolveBlogSuccess = {
  kind: "blog";
  blog: Blog;
  resolution: string;
  requestedId?: string;
};

export type ResolveBlogAmbiguous = {
  kind: "ambiguous";
  candidates: Blog[];
  query: string;
  requestedId?: string;
};

export type ResolveBlogResult = ResolveBlogSuccess | ResolveBlogAmbiguous;

/** Strip filler so "show the post about jokers" → "jokers". */
export function extractTopicSearchNeedle(hint: string): string {
  return hint
    .replace(/\b(?:show|open|view|get|fetch|preview|find|read|display|pull up|bring up)\b/gi, " ")
    .replace(/\b(?:the|a|an|my|our|that|this|me)\b/gi, " ")
    .replace(/\b(?:post|blog|draft|article|piece|content)\b/gi, " ")
    .replace(/\b(?:about|on|regarding|for|titled|called|named)\b/gi, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well a blog matches a topic/idea needle.
 * Title hits rank above excerpt, then content; shorter title overlaps score higher.
 */
export function scoreBlogTopicMatch(blog: Blog, needle: string): number {
  const q = needle.toLowerCase().trim();
  if (!q) return 0;

  const title = (blog.title || "").toLowerCase();
  const excerpt = (blog.excerpt || "").toLowerCase();
  const content = (blog.content || "").toLowerCase();
  const stop = new Set([
    "and",
    "the",
    "for",
    "with",
    "from",
    "that",
    "this",
    "into",
    "about",
    "being",
    "have",
    "has",
    "was",
    "were",
    "are",
    "you",
    "your",
  ]);
  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !stop.has(t));

  let score = 0;

  if (title === q) return 1000;
  if (title.includes(q)) {
    score += 500 + Math.max(0, 120 - title.length);
  } else if (q.includes(title.slice(0, 24)) && title.length >= 8) {
    score += 400;
  }

  if (tokens.length > 0) {
    const titleHits = tokens.filter((t) => title.includes(t)).length;
    score += titleHits * 80;
    const excerptHits = tokens.filter((t) => excerpt.includes(t)).length;
    score += excerptHits * 40;
    const contentHits = tokens.filter((t) => content.includes(t)).length;
    score += Math.min(contentHits, 8) * 10;
  }

  if (excerpt.includes(q)) score += 200;
  if (content.includes(q)) score += 100;

  return score;
}

/** Pick a clear winner or mark the result ambiguous for list UI. */
export function pickTopicMatch(
  blogs: Blog[],
  needle: string
): { kind: "blog"; blog: Blog; resolution: string } | { kind: "ambiguous"; candidates: Blog[] } | null {
  if (!needle || blogs.length === 0) return null;

  const ranked = blogs
    .map((blog) => ({ blog, score: scoreBlogTopicMatch(blog, needle) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return null;
  if (ranked.length === 1) {
    return { kind: "blog", blog: ranked[0].blog, resolution: "topic_search" };
  }

  const [top, second] = ranked;
  const clearlyAhead = top.score >= second.score * 2 || top.score - second.score >= 150;
  if (clearlyAhead && top.score >= 100) {
    return { kind: "blog", blog: top.blog, resolution: "topic_search" };
  }

  return {
    kind: "ambiguous",
    candidates: ranked.slice(0, 10).map((r) => r.blog),
  };
}

/**
 * Resolve a blog for get/review/update when the supervisor passes a stale id
 * (common after delete) or only a title/topic phrase. Prefers exact id, then slug,
 * title, topic search across title/excerpt/content, then the single remaining post.
 *
 * When several posts match a topic equally well, returns `kind: "ambiguous"` so
 * `blogs.get` can open a ranked list in the results panel.
 */
export async function resolveBlogForTool(
  blogService: BlogService,
  siteId: string,
  opts: { id?: string; slug?: string; titleHint?: string }
): Promise<ResolveBlogResult> {
  const requestedId = opts.id?.trim() || undefined;

  if (requestedId) {
    try {
      const blog = await blogService.getBlogById(requestedId, siteId);
      return { kind: "blog", blog, resolution: "id", requestedId };
    } catch (e) {
      if (!isNotFoundError(e)) throw e;
    }
  }

  if (opts.slug?.trim()) {
    try {
      const blog = await blogService.getBlogBySlug(opts.slug.trim(), siteId);
      return { kind: "blog", blog, resolution: "slug", requestedId };
    } catch (e) {
      if (!isNotFoundError(e)) throw e;
    }
  }

  const titleHint = opts.titleHint?.trim();
  const searchNeedle = titleHint ? extractTopicSearchNeedle(titleHint) || titleHint : "";

  if (searchNeedle) {
    const searched = await blogService.getAllBlogs(siteId, {
      search: searchNeedle.slice(0, 200),
      limit: 20,
      page: 1,
    });
    let picked = pickTopicMatch(searched.data, searchNeedle);
    if (picked?.kind === "blog") {
      return { kind: "blog", blog: picked.blog, resolution: picked.resolution, requestedId };
    }
    if (picked?.kind === "ambiguous") {
      return {
        kind: "ambiguous",
        candidates: picked.candidates,
        query: searchNeedle,
        requestedId,
      };
    }

    // Phrase regex often misses token-level matches — score a broader page.
    const listed = await blogService.getAllBlogs(siteId, { limit: 50, page: 1 });
    picked = pickTopicMatch(listed.data, searchNeedle);
    if (picked?.kind === "blog") {
      return { kind: "blog", blog: picked.blog, resolution: picked.resolution, requestedId };
    }
    if (picked?.kind === "ambiguous") {
      return {
        kind: "ambiguous",
        candidates: picked.candidates,
        query: searchNeedle,
        requestedId,
      };
    }

    const needle = searchNeedle.toLowerCase();
    const exact = listed.data.find((b) => b.title.toLowerCase() === needle);
    if (exact) return { kind: "blog", blog: exact, resolution: "title_exact", requestedId };
    const partial = listed.data.find(
      (b) => b.title.toLowerCase().includes(needle) || needle.includes(b.title.toLowerCase().slice(0, 24))
    );
    if (partial) return { kind: "blog", blog: partial, resolution: "title_partial", requestedId };

    if (listed.data.length === 1) {
      return { kind: "blog", blog: listed.data[0], resolution: "single_remaining", requestedId };
    }

    // No strong match — still return a pickable list so the results panel can open.
    if (listed.data.length > 0) {
      return {
        kind: "ambiguous",
        candidates: listed.data.slice(0, 10),
        query: searchNeedle,
        requestedId,
      };
    }

    throw new NotFoundError(
      requestedId
        ? `Blog not found for id '${requestedId}'. No posts in this workspace.`
        : `No blog matched '${searchNeedle}'. No posts in this workspace.`
    );
  }

  const listed = await blogService.getAllBlogs(siteId, { limit: 50, page: 1 });
  if (listed.data.length === 1) {
    return { kind: "blog", blog: listed.data[0], resolution: "single_remaining", requestedId };
  }

  const catalog = listed.data
    .slice(0, 8)
    .map((b) => `'${b.title}' (id=${b._id?.toString()})`)
    .join("; ");

  throw new NotFoundError(
    requestedId
      ? `Blog not found for id '${requestedId}'. Current posts: ${catalog || "(none)"}. Call blogs.list, then retry with a current id or title.`
      : `Blog not found. Current posts: ${catalog || "(none)"}. Call blogs.list, then retry with a current id or title.`
  );
}

/** Require a single blog (for review/update). Ambiguous matches become NotFoundError. */
export async function resolveSingleBlogForTool(
  blogService: BlogService,
  siteId: string,
  opts: { id?: string; slug?: string; titleHint?: string }
): Promise<{ blog: Blog; resolution: string; requestedId?: string }> {
  const resolved = await resolveBlogForTool(blogService, siteId, opts);
  if (resolved.kind === "blog") {
    return { blog: resolved.blog, resolution: resolved.resolution, requestedId: resolved.requestedId };
  }
  const catalog = resolved.candidates
    .slice(0, 8)
    .map((b) => `'${b.title}' (id=${b._id?.toString()})`)
    .join("; ");
  throw new NotFoundError(
    `Multiple posts match '${resolved.query}': ${catalog}. Retry with a specific id or exact title.`
  );
}

function isNotFoundError(e: unknown): boolean {
  if (e instanceof NotFoundError) return true;
  if (typeof e === "object" && e !== null && "statusCode" in e) {
    return (e as { statusCode: number }).statusCode === 404;
  }
  return e instanceof Error && /not found/i.test(e.message);
}

/** Map common LLM key aliases to the campaign tool schema. */
export function normalizeCampaignToolInput(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  if (!out.campaign_id) {
    if (typeof out.id === "string" && out.id.trim()) {
      out.campaign_id = out.id.trim();
    } else if (typeof out.campaignId === "string" && out.campaignId.trim()) {
      out.campaign_id = out.campaignId.trim();
    }
  }
  return out;
}

/**
 * Resolve campaign_id when the supervisor omits it but passes goal/name/theme
 * (common when treating generateRoadmap like a create-plan call).
 */
export async function resolveCampaignIdForTool(
  repo: CampaignRepository,
  siteId: string,
  userId: string,
  raw: Record<string, unknown>
): Promise<{ campaignId: string; resolution: string } | null> {
  const input = normalizeCampaignToolInput(raw);
  const explicit = input.campaign_id;
  if (typeof explicit === "string" && explicit.trim()) {
    return { campaignId: explicit.trim(), resolution: "explicit" };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name) {
    const byName = await repo.findByUser(userId, siteId, { search: name });
    const exact = byName.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exact?._id) {
      return { campaignId: exact._id.toString(), resolution: "name_exact" };
    }
    if (byName.length === 1 && byName[0]._id) {
      return { campaignId: byName[0]._id.toString(), resolution: "name_single_match" };
    }
  }

  const goal = typeof input.goal === "string" ? input.goal.trim() : "";
  if (goal) {
    const byGoal = await repo.findByUser(userId, siteId, { search: goal.slice(0, 120) });
    const exactGoal = byGoal.find((c) => c.goal === goal);
    if (exactGoal?._id) {
      return { campaignId: exactGoal._id.toString(), resolution: "goal_exact" };
    }
    if (byGoal.length === 1 && byGoal[0]._id) {
      return { campaignId: byGoal[0]._id.toString(), resolution: "goal_single_match" };
    }
  }

  const recent = await repo.findByUser(userId, siteId);
  const open = recent.filter(
    (c) =>
      c.lifecycle_status === CampaignLifecycleStatus.DRAFT ||
      c.lifecycle_status === CampaignLifecycleStatus.PLANNING ||
      c.lifecycle_status === CampaignLifecycleStatus.AWAITING_APPROVAL ||
      c.status === CampaignStatus.DRAFT
  );
  if (open.length === 1 && open[0]._id) {
    return { campaignId: open[0]._id.toString(), resolution: "single_open_campaign" };
  }

  return null;
}

/**
 * Parse opaque tool input from the supervisor using the provided Zod schema.
 * Throws a BadRequestError with a model-friendly message on validation failure
 * so the planner gets a useful follow-up signal instead of a 500.
 */
export function parseToolInput<Schema extends ZodTypeAny>(
  schema: Schema,
  raw: Record<string, unknown>,
  toolName: string
): z.infer<Schema> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new BadRequestError(`Invalid input for '${toolName}': ${issues}`);
  }
  return parsed.data;
}

/**
 * Truncate user-visible summary strings so a single tool result never blows
 * past LLM context windows when fed back into the supervisor.
 */
export function truncateSummary(text: string, max = 1200): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\u2026`;
}
