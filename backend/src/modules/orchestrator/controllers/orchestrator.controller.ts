import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { OrchestratorApprovalStatus } from "../../../shared/schemas/orchestrator-approval.schema";
import { OrchestratorService } from "../services/orchestrator.service";
import { serializeApproval } from "../interfaces/orchestrator.interface";

@injectable()
export class OrchestratorController {
  constructor(private orchestratorService: OrchestratorService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  /**
   * POST /sites/:siteId/orchestrator/chat
   * One active-mode turn. Optionally resumes an existing thread via thread_id.
   */
  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const { thread_id, message } = req.validatedBody as {
        thread_id?: string;
        message: string;
      };
      const response = await this.orchestratorService.chat({
        siteId,
        userId,
        message,
        threadId: thread_id,
      });
      sendSuccess(res, "OK", response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /sites/:siteId/orchestrator/onboarding/chat
   * Onboarding-mode turn. The single canonical onboarding thread is resolved
   * server-side regardless of any thread_id the client supplies.
   */
  onboardingChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const { message } = req.validatedBody as { message: string };
      const response = await this.orchestratorService.onboardingChat({ siteId, userId, message });
      sendSuccess(res, "OK", response);
    } catch (error) {
      next(error);
    }
  };

  listThreads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const limit = (req.validatedQuery as { limit?: number } | undefined)?.limit;
      const threads = await this.orchestratorService.listThreads(siteId, userId, limit);
      sendSuccess(res, "OK", { threads });
    } catch (error) {
      next(error);
    }
  };

  getThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { siteId, threadId } = req.validatedParams as { siteId: string; threadId: string };
      const data = await this.orchestratorService.getThreadWithMessages(threadId, siteId, userId);
      sendSuccess(res, "OK", data);
    } catch (error) {
      next(error);
    }
  };

  listApprovals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const { status, limit } = (req.validatedQuery as { status?: string; limit?: number }) ?? {};
      const approvals = await this.orchestratorService.listApprovals(
        siteId,
        userId,
        status as OrchestratorApprovalStatus | undefined,
        limit
      );
      sendSuccess(res, "OK", { approvals });
    } catch (error) {
      next(error);
    }
  };

  decideApproval = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { siteId, approvalId } = req.validatedParams as { siteId: string; approvalId: string };
      const { decision, note } = req.validatedBody as {
        decision: "approved" | "rejected";
        note?: string;
      };
      const approval = await this.orchestratorService.decideApproval(
        siteId,
        userId,
        approvalId,
        decision,
        note
      );
      sendCreated(res, "Approval decision recorded", { approval: serializeApproval(approval) });
    } catch (error) {
      next(error);
    }
  };
}
