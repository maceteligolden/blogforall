import { injectable } from "tsyringe";
import { CommentRepository } from "../repositories/comment.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateCommentInput, UpdateCommentInput, CommentQueryFilters } from "../interfaces/comment.interface";
import { Comment } from "../../../shared/schemas/comment.schema";
import { PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class CommentService {
  constructor(
    private commentRepository: CommentRepository,
    private blogRepository: BlogRepository
  ) {}

  async createComment(input: CreateCommentInput, authorId?: string): Promise<Comment> {
    // Verify blog exists
    const blog = await this.blogRepository.findById(input.blog);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    // Only allow comments on published blogs
    if (blog.status !== "published") {
      throw new BadRequestError("Comments can only be added to published blogs");
    }

    const comment = await this.commentRepository.create({
      ...input,
      author_id: authorId,
      is_approved: true, // Auto-approve for now
    });

    logger.info("Comment created", { commentId: comment._id, blogId: input.blog }, "CommentService");
    return comment;
  }

  async getCommentById(commentId: string): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }
    return comment;
  }

  async getCommentsByBlog(blogId: string, filters?: CommentQueryFilters): Promise<PaginatedResponse<Comment>> {
    // Verify blog exists
    const blog = await this.blogRepository.findById(blogId);
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    return this.commentRepository.findByBlog(blogId, {
      is_approved: filters?.is_approved ?? true, // Default to approved only
      page: filters?.page,
      limit: filters?.limit,
    });
  }

  async getCommentReplies(parentCommentId: string): Promise<Comment[]> {
    const parentComment = await this.commentRepository.findById(parentCommentId);
    if (!parentComment) {
      throw new NotFoundError("Parent comment not found");
    }

    return this.commentRepository.findReplies(parentCommentId);
  }

  async updateComment(commentId: string, authorId: string, input: UpdateCommentInput): Promise<Comment> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Only author or admin can update
    if (comment.author_id !== authorId) {
      throw new BadRequestError("You don't have permission to update this comment");
    }

    const updatedComment = await this.commentRepository.update(commentId, input);
    if (!updatedComment) {
      throw new NotFoundError("Comment not found");
    }

    logger.info("Comment updated", { commentId, authorId }, "CommentService");
    return updatedComment;
  }

  async deleteComment(commentId: string, authorId: string): Promise<void> {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError("Comment not found");
    }

    // Only author or admin can delete
    if (comment.author_id && comment.author_id !== authorId) {
      throw new BadRequestError("You don't have permission to delete this comment");
    }

    await this.commentRepository.delete(commentId);

    logger.info("Comment deleted", { commentId, authorId }, "CommentService");
  }

  async toggleLike(commentId: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    return this.commentRepository.toggleLike(commentId, userIdOrIp);
  }
}

