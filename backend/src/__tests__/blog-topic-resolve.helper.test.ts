import { describe, expect, it, jest } from "@jest/globals";
import type { Blog } from "../shared/schemas/blog.schema";
import { BlogStatus } from "../shared/constants";
import {
  extractTopicSearchNeedle,
  normalizeBlogToolInput,
  pickTopicMatch,
  resolveBlogForTool,
  scoreBlogTopicMatch,
} from "../modules/orchestrator/ai/tools/_helpers";
import type { BlogService } from "../modules/blog/services/blog.service";

function makeBlog(partial: Partial<Blog> & { title: string; _id?: string }): Blog {
  const { title, _id, slug, status, excerpt, content, ...rest } = partial;
  return {
    _id: _id ?? "blog-1",
    title,
    slug: slug ?? "slug",
    status: status ?? BlogStatus.DRAFT,
    excerpt: excerpt ?? "",
    content: content ?? "",
    site_id: "site-1",
    author: "user-1",
    content_type: "html",
    ...rest,
  } as Blog;
}

describe("normalizeBlogToolInput topic aliases", () => {
  it("maps query and topic to title", () => {
    expect(normalizeBlogToolInput({ query: "jokers" })).toEqual({ title: "jokers" });
    expect(normalizeBlogToolInput({ topic: "remote work" })).toEqual({ title: "remote work" });
  });

  it("keeps explicit title when query is also present", () => {
    const out = normalizeBlogToolInput({ title: "keep", query: "drop" });
    expect(out.title).toBe("keep");
    expect(out.query).toBe("drop");
  });
});

describe("extractTopicSearchNeedle", () => {
  it("strips show/open/about filler", () => {
    expect(extractTopicSearchNeedle("show the post about jokers")).toBe("jokers");
    expect(extractTopicSearchNeedle("open that remote work draft")).toBe("remote work");
  });
});

describe("scoreBlogTopicMatch / pickTopicMatch", () => {
  it("ranks title hits above excerpt and content", () => {
    const titleHit = makeBlog({ _id: "t", title: "Jokers in Card Games", content: "hello" });
    const excerptHit = makeBlog({
      _id: "e",
      title: "Unrelated",
      excerpt: "All about jokers",
      content: "x",
    });
    const contentHit = makeBlog({
      _id: "c",
      title: "Other",
      excerpt: "none",
      content: "A long essay featuring jokers and wildcards",
    });

    expect(scoreBlogTopicMatch(titleHit, "jokers")).toBeGreaterThan(scoreBlogTopicMatch(excerptHit, "jokers"));
    expect(scoreBlogTopicMatch(excerptHit, "jokers")).toBeGreaterThan(scoreBlogTopicMatch(contentHit, "jokers"));
  });

  it("returns a clear winner when one score dominates", () => {
    const winner = makeBlog({ _id: "win", title: "The Playful World of Jokers" });
    const loser = makeBlog({
      _id: "lose",
      title: "Poker Basics",
      content: "Mentions jokers once in a footnote about house rules",
    });
    const picked = pickTopicMatch([winner, loser], "jokers");
    expect(picked?.kind).toBe("blog");
    if (picked?.kind === "blog") {
      expect(picked.blog._id).toBe("win");
      expect(picked.resolution).toBe("topic_search");
    }
  });

  it("returns ambiguous when two title matches are close", () => {
    const a = makeBlog({ _id: "a", title: "Remote Work Tips" });
    const b = makeBlog({ _id: "b", title: "Remote Work Culture" });
    const picked = pickTopicMatch([a, b], "remote work");
    expect(picked?.kind).toBe("ambiguous");
    if (picked?.kind === "ambiguous") {
      expect(picked.candidates).toHaveLength(2);
    }
  });

  it("returns single topic_search when only one match", () => {
    const only = makeBlog({
      _id: "only",
      title: "SEO Guide",
      excerpt: "Deep dive into keywords",
      content: "keywords and clusters",
    });
    const other = makeBlog({ _id: "other", title: "Cooking Pasta", content: "boiling water" });
    const picked = pickTopicMatch([only, other], "keywords");
    expect(picked?.kind).toBe("blog");
    if (picked?.kind === "blog") {
      expect(picked.blog._id).toBe("only");
    }
  });
});

describe("resolveBlogForTool topic search", () => {
  it("returns full blog for a clear topic winner via getAllBlogs search", async () => {
    const winner = makeBlog({
      _id: "j1",
      title: "The Playful World of Jokers in Card Games",
      content: "Jokers add surprise",
    });
    const blogService = {
      getBlogById: jest.fn(),
      getBlogBySlug: jest.fn(),
      getAllBlogs: jest.fn(async () => ({
        data: [winner],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })),
    } as unknown as BlogService;

    const resolved = await resolveBlogForTool(blogService, "site-1", {
      titleHint: "show the post about jokers",
    });

    expect(resolved.kind).toBe("blog");
    if (resolved.kind === "blog") {
      expect(resolved.resolution).toBe("topic_search");
      expect(resolved.blog._id).toBe("j1");
    }
    expect(blogService.getAllBlogs).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ search: "jokers", limit: 20 })
    );
  });

  it("returns ambiguous candidates when several posts match", async () => {
    const a = makeBlog({ _id: "a", title: "Remote Work Tips" });
    const b = makeBlog({ _id: "b", title: "Remote Work Culture" });
    const blogService = {
      getBlogById: jest.fn(),
      getBlogBySlug: jest.fn(),
      getAllBlogs: jest.fn(async () => ({
        data: [a, b],
        pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
      })),
    } as unknown as BlogService;

    const resolved = await resolveBlogForTool(blogService, "site-1", {
      titleHint: "remote work",
    });

    expect(resolved.kind).toBe("ambiguous");
    if (resolved.kind === "ambiguous") {
      expect(resolved.candidates.map((c) => c._id)).toEqual(["a", "b"]);
      expect(resolved.query).toBe("remote work");
    }
  });
});
