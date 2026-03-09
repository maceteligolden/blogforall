import { injectable } from "tsyringe";
import { BlogRepository } from "../repositories/blog.repository";
import { CategoryRepository } from "../../category/repositories/category.repository";
import { ScheduledPostRepository } from "../../campaign/repositories/scheduled-post.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { BlogStatus } from "../../../shared/constants";
import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";
import { logger } from "../../../shared/utils/logger";
import { validateContentBlocks, blocksToHtml, htmlToPlainText } from "../../../shared/utils/content-blocks.util";
import { CreateBlogInput, UpdateBlogInput, BlogQueryFilters } from "../interfaces/blog.interface";
import { Blog } from "../../../shared/schemas/blog.schema";
import { PaginatedResponse } from "../../../shared/interfaces";
import type { ScheduledPost } from "../../../shared/schemas/scheduled-post.schema";

@injectable()
export class BlogService {
  constructor(
    private blogRepository: BlogRepository,
    private categoryRepository: CategoryRepository,
    private scheduledPostRepository: ScheduledPostRepository
  ) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  private generateExcerptFromHtml(html: string, maxLength = 250): string | undefined {
    if (!html || typeof html !== "string") return undefined;
    const plain = htmlToPlainText(html);
    if (!plain) return undefined;

    if (plain.length <= maxLength) {
      return plain;
    }

    const truncated = plain.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    const base = lastSpace > maxLength * 0.6 ? truncated.slice(0, lastSpace) : truncated;
    return `${base.trimEnd()}…`;
  }

  private async ensureUniqueSlug(slug: string, siteId: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existingBlog = await this.blogRepository.findBySlug(uniqueSlug, siteId);
      if (!existingBlog || (excludeId && existingBlog._id?.toString() === excludeId)) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async createBlog(authorId: string, siteId: string, input: CreateBlogInput): Promise<Blog> {
    const slug = await this.ensureUniqueSlug(this.generateSlug(input.title), siteId);

    // Validate category if provided
    if (input.category) {
      const category = await this.categoryRepository.findById(input.category, siteId);
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      if (!category.is_active) {
        throw new BadRequestError("Category is not active");
      }
    }

    let content = input.content ?? "";
    let content_blocks = input.content_blocks;

    if (content_blocks != null && content_blocks.length > 0) {
      validateContentBlocks(content_blocks);
      content = blocksToHtml(content_blocks);
    } else if (!content || content.trim() === "") {
      throw new BadRequestError("Content is required");
    }

    let excerpt = input.excerpt;
    if (!excerpt || excerpt.trim() === "") {
      excerpt = this.generateExcerptFromHtml(content);
    }

    const blog = await this.blogRepository.create({
      ...input,
      content,
      content_blocks,
      excerpt,
      author: authorId,
      site_id: siteId,
      slug,
      status: input.status || BlogStatus.DRAFT,
    });

    logger.info("Blog created", { blogId: blog._id, authorId, siteId }, "BlogService");
    return blog;
  }

  async getBlogById(blogId: string, siteId?: string, authorId?: string): Promise<Blog> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    // If authorId is provided, ensure the blog belongs to the author
    if (authorId && blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to access this blog");
    }

    return blog;
  }

  async getBlogBySlug(slug: string, siteId: string): Promise<Blog> {
    const blog = await this.blogRepository.findBySlug(slug, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    return blog;
  }

  async getUserBlogs(authorId: string, siteId: string, filters?: BlogQueryFilters): Promise<Blog[]> {
    return this.blogRepository.findByAuthor(authorId, siteId, { status: filters?.status });
  }

  async getAllBlogs(siteId: string, filters?: BlogQueryFilters): Promise<PaginatedResponse<Blog>> {
    return this.blogRepository.findAll(siteId, filters);
  }

  async getPublishedBlogs(siteId: string, filters?: BlogQueryFilters): Promise<PaginatedResponse<Blog>> {
    return this.blogRepository.findPublished(siteId, filters);
  }

  async updateBlog(blogId: string, siteId: string, authorId: string, input: UpdateBlogInput): Promise<Blog> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to update this blog");
    }

    const updateData: Partial<Blog> = { ...input };

    if (input.content_blocks != null && input.content_blocks.length > 0) {
      validateContentBlocks(input.content_blocks);
      updateData.content = blocksToHtml(input.content_blocks);
      updateData.content_blocks = input.content_blocks;
    }

    const effectiveContent = updateData.content ?? blog.content;
    if (input.excerpt !== undefined) {
      updateData.excerpt = input.excerpt || this.generateExcerptFromHtml(effectiveContent);
    } else if (!blog.excerpt) {
      updateData.excerpt = this.generateExcerptFromHtml(effectiveContent);
    }

    // Validate category if provided
    if (input.category) {
      const category = await this.categoryRepository.findById(input.category, siteId);
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      if (!category.is_active) {
        throw new BadRequestError("Category is not active");
      }
    }

    // If title is updated, regenerate slug
    if (input.title && input.title !== blog.title) {
      const newSlug = await this.ensureUniqueSlug(this.generateSlug(input.title), siteId, blogId);
      updateData.slug = newSlug;
    }

    // Handle status changes
    if (input.status) {
      if (input.status === BlogStatus.PUBLISHED && blog.status !== BlogStatus.PUBLISHED) {
        updateData.published_at = new Date();
      }
      updateData.status = input.status;
    }

    const updatedBlog = await this.blogRepository.update(blogId, siteId, updateData);
    if (!updatedBlog) {
      throw new NotFoundError("Blog not found");
    }

    logger.info("Blog updated", { blogId, authorId, siteId }, "BlogService");
    return updatedBlog;
  }

  async deleteBlog(blogId: string, siteId: string, authorId: string): Promise<void> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to delete this blog");
    }

    // Check if blog is scheduled
    const isScheduled = await this.scheduledPostRepository.isBlogScheduled(blogId);
    if (isScheduled) {
      throw new BadRequestError("Cannot delete blog that is scheduled. Please unschedule it first.");
    }

    await this.blogRepository.delete(blogId, siteId);
    logger.info("Blog deleted", { blogId, authorId, siteId }, "BlogService");
  }

  async publishBlog(blogId: string, siteId: string, authorId: string): Promise<Blog> {
    return this.updateBlog(blogId, siteId, authorId, {
      status: BlogStatus.PUBLISHED,
    });
  }

  async unpublishBlog(blogId: string, siteId: string, authorId: string): Promise<Blog> {
    return this.updateBlog(blogId, siteId, authorId, {
      status: BlogStatus.UNPUBLISHED,
    });
  }

  async incrementViews(blogId: string, siteId: string): Promise<void> {
    await this.blogRepository.incrementViews(blogId, siteId);
  }

  async toggleLike(blogId: string, siteId: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    return this.blogRepository.toggleLike(blogId, siteId, userIdOrIp);
  }

  /** Schedule this blog to be published at a future time. Cron will set status to published when due. */
  async scheduleBlogPublish(
    blogId: string,
    siteId: string,
    authorId: string,
    input: { scheduled_at: Date; timezone?: string }
  ): Promise<ScheduledPost> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to schedule this blog");
    }
    if (blog.status === BlogStatus.PUBLISHED) {
      throw new BadRequestError("Blog is already published");
    }
    const isScheduled = await this.scheduledPostRepository.isBlogScheduled(blogId);
    if (isScheduled) {
      throw new BadRequestError("This blog is already scheduled. Unschedule it first to change the date.");
    }
    if (input.scheduled_at <= new Date()) {
      throw new BadRequestError("Scheduled time must be in the future");
    }
    const scheduledPost = await this.scheduledPostRepository.create({
      blog_id: blogId,
      user_id: authorId,
      site_id: siteId,
      title: blog.title,
      scheduled_at: input.scheduled_at,
      timezone: input.timezone || "UTC",
      status: ScheduledPostStatus.PENDING,
      publish_attempts: 0,
      auto_generate: false,
    });
    logger.info(
      "Blog scheduled for publish",
      { blogId, scheduledPostId: scheduledPost._id, scheduled_at: input.scheduled_at },
      "BlogService"
    );
    return scheduledPost;
  }

  /** Get the active schedule for this blog (if any). */
  async getBlogSchedule(blogId: string, siteId: string, authorId: string): Promise<ScheduledPost | null> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to access this blog");
    }
    const posts = await this.scheduledPostRepository.findByBlog(blogId);
    const pending = posts.find(
      (p) => p.status === ScheduledPostStatus.PENDING || p.status === ScheduledPostStatus.SCHEDULED
    );
    return pending ?? null;
  }

  /** Remove the schedule so this blog will not be auto-published. */
  async unscheduleBlogPublish(blogId: string, siteId: string, authorId: string): Promise<void> {
    const blog = await this.blogRepository.findById(blogId, siteId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to unschedule this blog");
    }
    const posts = await this.scheduledPostRepository.findByBlog(blogId);
    const pending = posts.find(
      (p) => p.status === ScheduledPostStatus.PENDING || p.status === ScheduledPostStatus.SCHEDULED
    );
    if (!pending) {
      throw new BadRequestError("This blog is not scheduled");
    }
    await this.scheduledPostRepository.delete(pending._id!.toString(), siteId);
    logger.info("Blog unscheduled", { blogId, scheduledPostId: pending._id }, "BlogService");
  }
}
