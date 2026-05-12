import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { HttpStatus } from "../../../shared/constants";
import { getJwtUserId } from "../../../shared/utils/jwt-user";

/**
 * Placeholder controller for the Workspace Orchestrator Agent surface.
 *
 * All endpoints currently respond 501 Not Implemented. The full
 * implementation (chat supervisor, threads, approvals, onboarding) lands
 * in Phase 2; this scaffold exists so the router can be mounted now
 * and the frontend can stub against stable routes.
 */
@injectable()
export class OrchestratorController {
  private notImplemented(res: Response, name: string): void {
    res.status(HttpStatus.NOT_FOUND).json({
      success: false,
      message: `Orchestrator endpoint '${name}' is not yet implemented.`,
    });
  }

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  chat = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.notImplemented(res, "chat");
    } catch (error) {
      next(error);
    }
  };

  onboardingChat = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.notImplemented(res, "onboarding.chat");
    } catch (error) {
      next(error);
    }
  };

  listThreads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      sendSuccess(res, "Orchestrator threads (stub)", { siteId, userId, threads: [] });
    } catch (error) {
      next(error);
    }
  };

  getThread = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.notImplemented(res, "threads.get");
    } catch (error) {
      next(error);
    }
  };

  listApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      sendSuccess(res, "Orchestrator approvals (stub)", { siteId, userId, approvals: [] });
    } catch (error) {
      next(error);
    }
  };

  decideApproval = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.notImplemented(res, "approvals.decide");
    } catch (error) {
      next(error);
    }
  };
}
