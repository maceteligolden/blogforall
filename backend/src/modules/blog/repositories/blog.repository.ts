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

  async findById(id: string): Promise<BlogType | null> {
    return Blog.findById(id);
  }

  async findBySlug(slug: string): Promise<BlogType | null> {
    return Blog.findOne({ slug });
  }

  async findByAuthor(authorId: string, filters?: { status?: BlogStatus }): Promise<BlogType[]> {
    const query: { author: string; status?: BlogStatus } = { author: authorId };
    if (filters?.status) {
      query.status = filters.status;
    }
    return Blog.find(query).sort({ created_at: -1 });
  }

  async findAll(filters?: {
    status?: BlogStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<BlogType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (filters?.status) {
      query.status = filters.status;
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

  async findPublished(filters?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<BlogType>> {
    return this.findAll({
      ...filters,
      status: BlogStatus.PUBLISHED,
    });
  }

  async update(id: string, updateData: Partial<BlogType>): Promise<BlogType | null> {
    updateData.updated_at = new Date();
    return Blog.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<void> {
    await Blog.findByIdAndDelete(id);
  }

  async incrementViews(id: string): Promise<void> {
    await Blog.findByIdAndUpdate(id, { $inc: { views: 1 } });
  }

  async toggleLike(id: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    const blog = await Blog.findById(id);
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
}

