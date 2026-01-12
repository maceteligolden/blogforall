import { injectable } from "tsyringe";
import Comment, { Comment as CommentType } from "../../../shared/schemas/comment.schema";
import { PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class CommentRepository {
  async create(commentData: Partial<CommentType>): Promise<CommentType> {
    const comment = new Comment(commentData);
    return comment.save();
  }

  async findById(id: string): Promise<CommentType | null> {
    return Comment.findById(id);
  }

  async findByBlog(
    blogId: string,
    filters?: { is_approved?: boolean; page?: number; limit?: number }
  ): Promise<PaginatedResponse<CommentType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      blog: blogId,
      parent_comment: { $exists: false }, // Only top-level comments
    };

    if (filters?.is_approved !== undefined) {
      query.is_approved = filters.is_approved;
    }

    const [data, total] = await Promise.all([
      Comment.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
      Comment.countDocuments(query),
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

  async findReplies(parentCommentId: string): Promise<CommentType[]> {
    return Comment.find({ parent_comment: parentCommentId }).sort({ created_at: 1 });
  }

  async findByAuthor(authorId: string): Promise<CommentType[]> {
    return Comment.find({ author_id: authorId }).sort({ created_at: -1 });
  }

  async update(id: string, updateData: Partial<CommentType>): Promise<CommentType | null> {
    updateData.updated_at = new Date();
    return Comment.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<void> {
    await Comment.findByIdAndDelete(id);
  }

  async incrementLikes(id: string): Promise<void> {
    await Comment.findByIdAndUpdate(id, { $inc: { likes: 1 } });
  }

  async decrementLikes(id: string): Promise<void> {
    await Comment.findByIdAndUpdate(id, { $inc: { likes: -1 } });
  }

  async toggleLike(id: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    const comment = await Comment.findById(id);
    if (!comment) {
      throw new Error("Comment not found");
    }

    const likedIndex = comment.liked_by.indexOf(userIdOrIp);
    const isLiked = likedIndex !== -1;

    if (isLiked) {
      comment.liked_by.splice(likedIndex, 1);
      comment.likes = Math.max(0, comment.likes - 1);
    } else {
      comment.liked_by.push(userIdOrIp);
      comment.likes += 1;
    }

    await comment.save();
    return { likes: comment.likes, isLiked: !isLiked };
  }

  async getCommentCountByBlog(blogId: string): Promise<number> {
    return Comment.countDocuments({ blog: blogId, is_approved: true });
  }
}
