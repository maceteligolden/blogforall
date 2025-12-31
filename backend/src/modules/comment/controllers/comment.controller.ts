import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createCommentSchema, updateCommentSchema, commentQuerySchema } from "../validations/comment.validation";

@injectable()
export class CommentController {
  constructor(private commentService: CommentService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = createCommentSchema.parse(req.body);
      const authorId = req.user?.userId; // Optional - guests can comment
      const comment = await this.commentService.createComment(validatedData, authorId);
      sendCreated(res, "Comment created successfully", comment);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const comment = await this.commentService.getCommentById(id);
      sendSuccess(res, "Comment retrieved successfully", comment);
    } catch (error) {
      next(error);
    }
  };

  getByBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { blogId } = req.params;
      const validatedFilters = commentQuerySchema.parse(req.query);
      const result = await this.commentService.getCommentsByBlog(blogId, validatedFilters);
      sendSuccess(res, "Comments retrieved successfully", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { commentId } = req.params;
      const replies = await this.commentService.getCommentReplies(commentId);
      sendSuccess(res, "Comment replies retrieved successfully", replies);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("Authentication required to update comment"));
      }

      const validatedData = updateCommentSchema.parse(req.body);
      const comment = await this.commentService.updateComment(id, userId, validatedData);
      sendSuccess(res, "Comment updated successfully", comment);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("Authentication required to delete comment"));
      }

      await this.commentService.deleteComment(id, userId);
      sendNoContent(res, "Comment deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const userIdOrIp = userId || req.ip || req.socket.remoteAddress || "unknown";
      const result = await this.commentService.toggleLike(id, userIdOrIp);
      sendSuccess(res, "Like toggled successfully", result);
    } catch (error) {
      next(error);
    }
  };
}

