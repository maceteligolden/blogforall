import { injectable } from "tsyringe";
import { z } from "zod";
import { BlogService } from "../../../blog/services/blog.service";
import { BlogStatus } from "../../../../shared/constants";
import type { Blog } from "../../../../shared/schemas/blog.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";

const BLOG_STATUS_VALUES: BlogStatus[] = [
  BlogStatus.DRAFT,
  BlogStatus.SCHEDULED,
  BlogStatus.PUBLISHED,
  BlogStatus.UNPUBLISHED,
];

function projectBlog(b: Blog) {
  return {
    id: b._id?.toString(),
    title: b.title,
    slug: b.slug,
    status: b.status,
    category: b.category,
    excerpt: b.excerpt,
    published_at: b.published_at,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

// -----------------------------------------------------------------------------
// blogs.list
// -----------------------------------------------------------------------------

const listInputSchema = z.object({
  status: z.enum(BLOG_STATUS_VALUES as [BlogStatus, ...BlogStatus[]]).optional(),
  category: z.string().min(1).optional(),
  search: z.string().min(1).max(200).optional(),
  page: z.number().int().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(50).optional(),
  mine_only: z.boolean().optional(),
});

@injectable()
export class BlogListTool implements OrchestratorTool {
  name = "blogs.list";
  description =
    "List blog posts in this workspace. Filter by status (draft/scheduled/published/unpublished), category id, free-text search, or pagination. Set mine_only=true to limit to the current user's posts.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(listInputSchema, invocation.input, this.name);
    if (input.mine_only) {
      const blogs = await this.blogService.getUserBlogs(invocation.userId, invocation.siteId, {
        status: input.status,
      });
      const filtered = this.applyAdditionalFilters(blogs, input);
      return {
        summary: truncateSummary(
          `Found ${filtered.length} of your blog posts${this.statusLabel(input.status)}. ${this.previewTitles(filtered)}`
        ),
        data: { blogs: filtered.map(projectBlog), total: filtered.length, mine_only: true },
      };
    }
    const result = await this.blogService.getAllBlogs(invocation.siteId, {
      status: input.status,
      category: input.category,
      search: input.search,
      page: input.page,
      limit: input.limit ?? 10,
    });
    return {
      summary: truncateSummary(
        `Found ${result.pagination.total} workspace blog posts${this.statusLabel(input.status)} (showing ${result.data.length}). ${this.previewTitles(result.data)}`
      ),
      data: {
        blogs: result.data.map(projectBlog),
        pagination: result.pagination,
      },
    };
  }

  private applyAdditionalFilters(blogs: Blog[], input: z.infer<typeof listInputSchema>): Blog[] {
    let out = blogs;
    if (input.category) {
      out = out.filter((b) => b.category === input.category);
    }
    if (input.search) {
      const needle = input.search.toLowerCase();
      out = out.filter((b) => b.title.toLowerCase().includes(needle) || (b.excerpt || "").toLowerCase().includes(needle));
    }
    return out.slice(0, input.limit ?? 10);
  }

  private statusLabel(status?: BlogStatus): string {
    return status ? ` (status=${status})` : "";
  }

  private previewTitles(blogs: Blog[]): string {
    if (blogs.length === 0) return "";
    return `Recent: ${blogs.slice(0, 5).map((b) => `'${b.title}'`).join(", ")}.`;
  }
}

// -----------------------------------------------------------------------------
// blogs.get
// -----------------------------------------------------------------------------

const getInputSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

@injectable()
export class BlogGetTool implements OrchestratorTool {
  name = "blogs.get";
  description = "Fetch a single blog post by id or slug. Include full content + meta.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(getInputSchema, invocation.input, this.name);
    if (!input.id && !input.slug) {
      throw new Error("Provide one of id or slug.");
    }
    const blog = input.id
      ? await this.blogService.getBlogById(input.id, invocation.siteId)
      : await this.blogService.getBlogBySlug(input.slug!, invocation.siteId);
    return {
      summary: `Blog '${blog.title}' is currently ${blog.status}. Excerpt: ${(blog.excerpt || "(none)").slice(0, 200)}.`,
      data: {
        id: blog._id?.toString(),
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        category: blog.category,
        excerpt: blog.excerpt,
        content_html: blog.content,
        published_at: blog.published_at,
        created_at: blog.created_at,
        updated_at: blog.updated_at,
        meta: blog.meta,
      },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.statistics
// -----------------------------------------------------------------------------

@injectable()
export class BlogStatisticsTool implements OrchestratorTool {
  name = "blogs.statistics";
  description =
    "Return high-level workspace blog statistics: counts by status, total views/likes across published posts, and recent publishing cadence.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    // Pull a single large page; for analytics-level summaries this is fine
    // for v1 and avoids adding new repository methods.
    const result = await this.blogService.getAllBlogs(invocation.siteId, { limit: 500, page: 1 });
    const counts: Record<string, number> = {
      draft: 0,
      scheduled: 0,
      published: 0,
      unpublished: 0,
    };
    let totalViews = 0;
    let totalLikes = 0;
    let mostRecentPublishedAt: Date | null = null;
    for (const b of result.data) {
      counts[b.status] = (counts[b.status] ?? 0) + 1;
      if (b.status === BlogStatus.PUBLISHED) {
        totalViews += (b as unknown as { views?: number }).views ?? 0;
        totalLikes += (b as unknown as { likes?: number }).likes ?? 0;
        if (
          b.published_at &&
          (!mostRecentPublishedAt || new Date(b.published_at) > mostRecentPublishedAt)
        ) {
          mostRecentPublishedAt = new Date(b.published_at);
        }
      }
    }
    const summary = truncateSummary(
      `Workspace blog stats: ${counts.published} published, ${counts.draft} drafts, ${counts.scheduled} scheduled, ${counts.unpublished} unpublished. Lifetime views: ${totalViews}, likes: ${totalLikes}.`
    );
    return {
      summary,
      data: {
        counts,
        total_views: totalViews,
        total_likes: totalLikes,
        most_recent_published_at: mostRecentPublishedAt,
        total_in_workspace: result.pagination.total,
        sampled: result.data.length,
      },
    };
  }
}
