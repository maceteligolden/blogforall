import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { CreateCommentInput, UpdateCommentInput, CommentQueryFilters } from "../interfaces/comment.interface";

@injectable()
export class CommentController {
  constructor(private commentService: CommentService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = req.validatedBody as CreateCommentInput;
      const authorId = req.user?.userId;
      const comment = await this.commentService.createComment(validatedData, authorId);
      sendCreated(res, "Comment created successfully", comment);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { id: string };
      const comment = await this.commentService.getCommentById(id);
      sendSuccess(res, "Comment retrieved successfully", comment);
    } catch (error) {
      next(error);
    }
  };

  getByBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { blogId } = req.validatedParams as { blogId: string };
      const validatedFilters = req.validatedQuery as CommentQueryFilters;
      const result = await this.commentService.getCommentsByBlog(blogId, validatedFilters);
      sendSuccess(res, "Comments retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = req.validatedParams as { commentId: string };
      const replies = await this.commentService.getCommentReplies(commentId);
      sendSuccess(res, "Comment replies retrieved successfully", replies);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { id: string };
      const userId = getJwtUserId(req);
      const validatedData = req.validatedBody as UpdateCommentInput;
      const comment = await this.commentService.updateComment(id, userId, validatedData);
      sendSuccess(res, "Comment updated successfully", comment);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { id: string };
      const userId = getJwtUserId(req);
      await this.commentService.deleteComment(id, userId);
      sendNoContent(res, "Comment deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { id: string };
      const userId = req.user?.userId;
      const userIdOrIp = userId || req.ip || req.socket.remoteAddress || "unknown";
      const result = await this.commentService.toggleLike(id, userIdOrIp);
      sendSuccess(res, "Like toggled successfully", result);
    } catch (error) {
      next(error);
    }
  };
}
