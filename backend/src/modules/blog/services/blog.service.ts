import { injectable } from "tsyringe";
import { BlogRepository } from "../repositories/blog.repository";
import { CategoryRepository } from "../../category/repositories/category.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { BlogStatus } from "../../../shared/constants";
import { logger } from "../../../shared/utils/logger";
import { CreateBlogInput, UpdateBlogInput, BlogQueryFilters } from "../interfaces/blog.interface";
import { Blog } from "../../../shared/schemas/blog.schema";
import { PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class BlogService {
  constructor(
    private blogRepository: BlogRepository,
    private categoryRepository: CategoryRepository
  ) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existingBlog = await this.blogRepository.findBySlug(uniqueSlug);
      if (!existingBlog || (excludeId && existingBlog._id?.toString() === excludeId)) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async createBlog(authorId: string, input: CreateBlogInput): Promise<Blog> {
    const slug = await this.ensureUniqueSlug(this.generateSlug(input.title));

    // Validate category if provided
    if (input.category) {
      const category = await this.categoryRepository.findById(input.category, authorId);
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      if (!category.is_active) {
        throw new BadRequestError("Category is not active");
      }
    }

    const blog = await this.blogRepository.create({
      ...input,
      author: authorId,
      slug,
      status: input.status || BlogStatus.DRAFT,
    });

    logger.info("Blog created", { blogId: blog._id, authorId }, "BlogService");
    return blog;
  }

  async getBlogById(blogId: string, authorId?: string): Promise<Blog> {
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    // If authorId is provided, ensure the blog belongs to the author
    if (authorId && blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to access this blog");
    }

    return blog;
  }

  async getBlogBySlug(slug: string): Promise<Blog> {
    const blog = await this.blogRepository.findBySlug(slug);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }
    return blog;
  }

  async getUserBlogs(authorId: string, filters?: BlogQueryFilters): Promise<Blog[]> {
    return this.blogRepository.findByAuthor(authorId, { status: filters?.status });
  }

  async getAllBlogs(filters?: BlogQueryFilters): Promise<PaginatedResponse<Blog>> {
    return this.blogRepository.findAll(filters);
  }

  async getPublishedBlogs(filters?: BlogQueryFilters): Promise<PaginatedResponse<Blog>> {
    return this.blogRepository.findPublished(filters);
  }

  async updateBlog(blogId: string, authorId: string, input: UpdateBlogInput): Promise<Blog> {
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to update this blog");
    }

    const updateData: Partial<Blog> = { ...input };

    // Validate category if provided
    if (input.category) {
      const category = await this.categoryRepository.findById(input.category, authorId);
      if (!category) {
        throw new NotFoundError("Category not found");
      }
      if (!category.is_active) {
        throw new BadRequestError("Category is not active");
      }
    }

    // If title is updated, regenerate slug
    if (input.title && input.title !== blog.title) {
      const newSlug = await this.ensureUniqueSlug(this.generateSlug(input.title), blogId);
      updateData.slug = newSlug;
    }

    // Handle status changes
    if (input.status) {
      if (input.status === BlogStatus.PUBLISHED && blog.status !== BlogStatus.PUBLISHED) {
        updateData.published_at = new Date();
      }
      updateData.status = input.status;
    }

    const updatedBlog = await this.blogRepository.update(blogId, updateData);
    if (!updatedBlog) {
      throw new NotFoundError("Blog not found");
    }

    logger.info("Blog updated", { blogId, authorId }, "BlogService");
    return updatedBlog;
  }

  async deleteBlog(blogId: string, authorId: string): Promise<void> {
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    if (blog.author !== authorId) {
      throw new ForbiddenError("You don't have permission to delete this blog");
    }

    await this.blogRepository.delete(blogId);
    logger.info("Blog deleted", { blogId, authorId }, "BlogService");
  }

  async publishBlog(blogId: string, authorId: string): Promise<Blog> {
    return this.updateBlog(blogId, authorId, {
      status: BlogStatus.PUBLISHED,
    });
  }

  async unpublishBlog(blogId: string, authorId: string): Promise<Blog> {
    return this.updateBlog(blogId, authorId, {
      status: BlogStatus.UNPUBLISHED,
    });
  }

  async incrementViews(blogId: string): Promise<void> {
    await this.blogRepository.incrementViews(blogId);
  }

  async toggleLike(blogId: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    return this.blogRepository.toggleLike(blogId, userIdOrIp);
  }
}

