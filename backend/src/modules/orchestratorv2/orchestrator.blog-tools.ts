import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { BlogService } from "../blog/services/blog.service";
import { BlogStatus } from "../../shared/constants";
import { ScheduledPostRepository } from "../campaign/repositories/scheduled-post.repository";
import { CampaignPostItemRepository } from "../campaign/repositories/campaign-post-item.repository";
import { assertBlogNotCampaignImmediatePublish } from "../campaign/utils/campaign-publish-guard";
import { env } from "../../shared/config/env";

export type BlogToolContext = {
  siteId: string;
  userId: string;
};

function toolResult(summary: string, data: Record<string, unknown> = {}): string {
  return JSON.stringify({ summary, ...data });
}

function previewUrl(blogId: string): string {
  const base = env.frontend.baseUrl.replace(/\/$/, "");
  return `${base}/dashboard/posts/${blogId}`;
}

function projectBlog(blog: {
  _id?: { toString(): string } | string;
  title?: string;
  slug?: string;
  status?: string;
  excerpt?: string;
  published_at?: Date;
  updated_at?: Date;
}) {
  const id = typeof blog._id === "string" ? blog._id : blog._id?.toString();
  return {
    id,
    title: blog.title,
    slug: blog.slug,
    status: blog.status,
    excerpt: blog.excerpt,
    published_at: blog.published_at,
    updated_at: blog.updated_at,
    preview_url: id ? previewUrl(id) : undefined,
  };
}

export function formatBlogPublishDraft(args: Record<string, unknown>): string {
  const id = typeof args.id === "string" ? args.id : "";
  return `Publish this blog post now?${id ? `\nPost: ${id}` : ""}`;
}

export function formatBlogUnpublishDraft(args: Record<string, unknown>): string {
  const id = typeof args.id === "string" ? args.id : "";
  return `Unpublish this blog post?${id ? `\nPost: ${id}` : ""}`;
}

export function formatBlogScheduleDraft(args: Record<string, unknown>): string {
  const id = typeof args.id === "string" ? args.id : "";
  const when = typeof args.scheduled_at === "string" ? args.scheduled_at : "";
  return [`Schedule this blog post?`, id ? `Post: ${id}` : "", when ? `When: ${when}` : ""]
    .filter(Boolean)
    .join("\n");
}

export function formatBlogUnscheduleDraft(args: Record<string, unknown>): string {
  const id = typeof args.id === "string" ? args.id : "";
  return `Cancel the scheduled publish for this post?${id ? `\nPost: ${id}` : ""}`;
}

export function createBlogTools(ctx: BlogToolContext) {
  const blogs = container.resolve(BlogService);

  const blogs_list = tool(
    async (input: { status?: string; search?: string; limit?: number }) => {
      const result = await blogs.getAllBlogs(ctx.siteId, {
        status: input.status as BlogStatus | undefined,
        search: input.search,
        limit: input.limit ?? 10,
        page: 1,
      });
      const items = result.data.map(projectBlog);
      return toolResult(
        items.length
          ? `Found ${result.pagination.total} blog posts. Showing ${items.length}: ${items.map((b) => b.title).join("; ")}`
          : "No blog posts match that filter.",
        { blogs: items, total: result.pagination.total },
      );
    },
    {
      name: "blogs_list",
      description:
        "List existing blog posts in this workspace. Filter by status (draft/scheduled/published/unpublished) or search. New posts are written with the writing skill — never generate a post here.",
      schema: z.object({
        status: z.enum(["draft", "generating", "scheduled", "published", "unpublished"]).optional(),
        search: z.string().max(200).optional(),
        limit: z.number().int().min(1).max(20).optional(),
      }),
    },
  );

  const blogs_get = tool(
    async (input: { id?: string; title?: string }) => {
      if (input.id) {
        const blog = await blogs.getBlogById(input.id, ctx.siteId, ctx.userId);
        const projected = projectBlog(blog);
        return toolResult(`Opened "${blog.title}" (${blog.status}).`, {
          ...projected,
          content: blog.content,
        });
      }
      const title = input.title?.trim();
      if (!title) {
        return toolResult("Pass id or title to open a blog post.");
      }
      const result = await blogs.getAllBlogs(ctx.siteId, { search: title, limit: 5, page: 1 });
      const match =
        result.data.find((row) => row.title.trim().toLowerCase() === title.toLowerCase()) ||
        result.data[0];
      if (!match?._id) {
        return toolResult(`No blog post matched "${title}".`);
      }
      const blog = await blogs.getBlogById(String(match._id), ctx.siteId, ctx.userId);
      const projected = projectBlog(blog);
      return toolResult(`Opened "${blog.title}" (${blog.status}).`, {
        ...projected,
        content: blog.content,
      });
    },
    {
      name: "blogs_get",
      description: "Open an existing blog post by id or title. Use for review, publish, or schedule — not to write a new post.",
      schema: z.object({
        id: z.string().optional(),
        title: z.string().max(400).optional(),
      }),
    },
  );

  const blogs_publish = tool(
    async (input: { id: string }) => {
      const scheduled = container.resolve(ScheduledPostRepository);
      const items = container.resolve(CampaignPostItemRepository);
      await assertBlogNotCampaignImmediatePublish(input.id, ctx.siteId, scheduled, items);
      const blog = await blogs.publishBlog(input.id, ctx.siteId, ctx.userId);
      return toolResult(`Published "${blog.title}".`, projectBlog(blog));
    },
    {
      name: "blogs_publish",
      description:
        "Publish an existing evergreen blog post now. Campaign posts must go through schedule review. HITL-gated.",
      schema: z.object({ id: z.string().min(1) }),
    },
  );

  const blogs_unpublish = tool(
    async (input: { id: string }) => {
      const blog = await blogs.unpublishBlog(input.id, ctx.siteId, ctx.userId);
      return toolResult(`Unpublished "${blog.title}".`, projectBlog(blog));
    },
    {
      name: "blogs_unpublish",
      description: "Unpublish an existing blog post. HITL-gated.",
      schema: z.object({ id: z.string().min(1) }),
    },
  );

  const blogs_schedule = tool(
    async (input: { id: string; scheduled_at: string; timezone?: string }) => {
      const at = new Date(input.scheduled_at);
      if (Number.isNaN(at.getTime())) {
        return toolResult("scheduled_at must be a valid ISO-8601 datetime.");
      }
      const scheduled = await blogs.scheduleBlogPublish(input.id, ctx.siteId, ctx.userId, {
        scheduled_at: at,
        timezone: input.timezone,
      });
      return toolResult(`Scheduled "${scheduled.title}" for ${at.toISOString()}.`, {
        scheduled_post_id: scheduled._id?.toString(),
        blog_id: input.id,
        scheduled_at: at.toISOString(),
      });
    },
    {
      name: "blogs_schedule",
      description:
        "Schedule an existing blog post to publish later. scheduled_at must be ISO-8601 in the future. HITL-gated.",
      schema: z.object({
        id: z.string().min(1),
        scheduled_at: z.string().min(1),
        timezone: z.string().max(64).optional(),
      }),
    },
  );

  const blogs_unschedule = tool(
    async (input: { id: string }) => {
      await blogs.unscheduleBlogPublish(input.id, ctx.siteId, ctx.userId);
      return toolResult("Removed the publish schedule for that post.", { blog_id: input.id });
    },
    {
      name: "blogs_unschedule",
      description: "Cancel a scheduled publish for an existing blog post. HITL-gated.",
      schema: z.object({ id: z.string().min(1) }),
    },
  );

  return [blogs_list, blogs_get, blogs_publish, blogs_unpublish, blogs_schedule, blogs_unschedule];
}
