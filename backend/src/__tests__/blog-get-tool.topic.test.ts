import { describe, expect, it, jest } from "@jest/globals";
import { BlogGetTool } from "../modules/orchestrator/ai/tools/blog-read.tools";
import type { BlogService } from "../modules/blog/services/blog.service";
import { BlogStatus } from "../shared/constants";
import type { Blog } from "../shared/schemas/blog.schema";
import type { OrchestratorToolInvocation } from "../modules/orchestrator/interfaces/orchestrator.interface";

function invocation(input: Record<string, unknown>): OrchestratorToolInvocation {
  return {
    siteId: "site-1",
    userId: "user-1",
    input,
  } as OrchestratorToolInvocation;
}

describe("BlogGetTool topic resolution", () => {
  it("returns full get data when title/topic has a clear winner", async () => {
    const blog = {
      _id: "j1",
      title: "The Playful World of Jokers in Card Games",
      slug: "jokers",
      status: BlogStatus.DRAFT,
      excerpt: "About jokers",
      content: "<p>Jokers add surprise</p>",
      site_id: "site-1",
      author: "user-1",
      content_type: "html",
    } as Blog;

    const blogService = {
      getBlogById: jest.fn(),
      getBlogBySlug: jest.fn(),
      getAllBlogs: jest.fn(async () => ({
        data: [blog],
        pagination: { total: 1, page: 1, limit: 20, totalPages: 1 },
      })),
    } as unknown as BlogService;

    const tool = new BlogGetTool(blogService);
    const result = await tool.run(invocation({ title: "jokers" }));

    expect(result.data).toMatchObject({
      blog_id: "j1",
      title: blog.title,
      content: blog.content,
      resolution: "topic_search",
    });
    expect(result.summary).toContain("Jokers");
  });

  it("returns list-shaped data when topic matches are ambiguous", async () => {
    const a = {
      _id: "a",
      title: "Remote Work Tips",
      slug: "a",
      status: BlogStatus.DRAFT,
      excerpt: "",
      content: "tips",
      site_id: "site-1",
      author: "user-1",
      content_type: "html",
    } as Blog;
    const b = {
      _id: "b",
      title: "Remote Work Culture",
      slug: "b",
      status: BlogStatus.DRAFT,
      excerpt: "",
      content: "culture",
      site_id: "site-1",
      author: "user-1",
      content_type: "html",
    } as Blog;

    const blogService = {
      getBlogById: jest.fn(),
      getBlogBySlug: jest.fn(),
      getAllBlogs: jest.fn(async () => ({
        data: [a, b],
        pagination: { total: 2, page: 1, limit: 20, totalPages: 1 },
      })),
    } as unknown as BlogService;

    const tool = new BlogGetTool(blogService);
    const result = await tool.run(invocation({ query: "remote work" }));

    expect(result.data).toMatchObject({
      ambiguous: true,
      resolution: "topic_ambiguous",
      total: 2,
    });
    expect(Array.isArray((result.data as { items: unknown[] }).items)).toBe(true);
    expect((result.data as { items: unknown[] }).items).toHaveLength(2);
  });
});
