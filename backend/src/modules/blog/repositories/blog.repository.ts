import { injectable } from "tsyringe";
import Blog, { Blog as BlogType } from "../../../shared/schemas/blog.schema";
import { BlogStatus } from "../../../shared/constants";
import { PaginationOptions, PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class BlogRepository {
  async create(blogData: Partial<BlogType>): Promise<BlogType> {
    const blog = new Blog(blogData);
    return blog.save();
  }

  async findById(id: string, siteId?: string): Promise<BlogType | null> {
    const query: Record<string, unknown> = { _id: id };
    if (siteId) {
      query.site_id = siteId;
    }
    return Blog.findOne(query);
  }

  async findBySlug(slug: string, siteId: string): Promise<BlogType | null> {
    return Blog.findOne({ slug, site_id: siteId });
  }

  async findByAuthor(authorId: string, siteId: string, filters?: { status?: BlogStatus }): Promise<BlogType[]> {
    const query: Record<string, unknown> = { author: authorId, site_id: siteId };
    if (filters?.status) {
      query.status = filters.status;
    }
    return Blog.find(query).sort({ created_at: -1 });
  }

  async findAll(siteId: string, filters?: {
    status?: BlogStatus;
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<BlogType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { site_id: siteId };
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.category) {
      query.category = filters.category;
    }
    if (filters?.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: "i" } },
        { excerpt: { $regex: filters.search, $options: "i" } },
        { content: { $regex: filters.search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      Blog.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
      Blog.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPublished(siteId: string, filters?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<BlogType>> {
    return this.findAll(siteId, {
      ...filters,
      status: BlogStatus.PUBLISHED,
    });
  }

  async update(id: string, siteId: string, updateData: Partial<BlogType>): Promise<BlogType | null> {
    updateData.updated_at = new Date();
    return Blog.findOneAndUpdate({ _id: id, site_id: siteId }, updateData, { new: true });
  }

  async delete(id: string, siteId: string): Promise<void> {
    await Blog.findOneAndDelete({ _id: id, site_id: siteId });
  }

  async incrementViews(id: string, siteId: string): Promise<void> {
    await Blog.findOneAndUpdate({ _id: id, site_id: siteId }, { $inc: { views: 1 } });
  }

  async toggleLike(id: string, siteId: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    const blog = await Blog.findOne({ _id: id, site_id: siteId });
    if (!blog) {
      throw new Error("Blog not found");
    }

    const likedIndex = blog.liked_by.indexOf(userIdOrIp);
    const isLiked = likedIndex !== -1;

    if (isLiked) {
      blog.liked_by.splice(likedIndex, 1);
      blog.likes = Math.max(0, blog.likes - 1);
    } else {
      blog.liked_by.push(userIdOrIp);
      blog.likes += 1;
    }

    await blog.save();
    return { likes: blog.likes, isLiked: !isLiked };
  }

  async incrementCommentCount(id: string): Promise<void> {
    // Comment count is tracked via Comment collection queries
    // This method is kept for consistency but doesn't modify blog document
  }

  async decrementCommentCount(id: string): Promise<void> {
    // Comment count is tracked via Comment collection queries
    // This method is kept for consistency but doesn't modify blog document
  }
}
