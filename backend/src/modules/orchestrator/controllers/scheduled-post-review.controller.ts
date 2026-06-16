import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { ScheduledPostReviewService } from "../services/scheduled-post-review.service";

/**
 * Public (unauthenticated) controller for the email-driven scheduled-post
 * review flow. Auth is enforced by the single-use review token in the URL,
 * not by JWT, so the workspace owner can decide directly from their inbox.
 */
@injectable()
export class ScheduledPostReviewController {
  constructor(private readonly reviewService: ScheduledPostReviewService) {}

  private token(req: Request): string {
    return (req.validatedParams as { token: string }).token;
  }

  /**
   * GET /scheduled-post-review/:token
   * Returns the read-only review context (post + draft) for the preview page.
   */
  getContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await this.reviewService.getReviewContext(this.token(req));
      sendSuccess(res, "OK", context);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /scheduled-post-review/:token/approve
   * Consumes the token, marks the post approved, and resolves the linked
   * orchestrator approval.
   */
  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.reviewService.approve(this.token(req));
      sendSuccess(res, "Approved", result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /scheduled-post-review/:token/rework
   * Consumes the token, captures the reviewer's notes, and re-triggers
   * preparation so a fresh draft is regenerated.
   */
  rework = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { comments } = req.validatedBody as { comments: string };
      const result = await this.reviewService.requestRework(this.token(req), comments);
      sendSuccess(res, "Rework requested", result);
    } catch (error) {
      next(error);
    }
  };
}
