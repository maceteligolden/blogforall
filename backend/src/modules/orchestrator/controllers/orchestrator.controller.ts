import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { getRequestIdFromHeaders } from "../../../shared/utils/request-id";
import { OrchestratorApprovalStatus } from "../../../shared/schemas/orchestrator-approval.schema";
import { OrchestratorService } from "../services/orchestrator.service";
import { OrchestratorKnowledgeService } from "../services/orchestrator-knowledge.service";
import { serializeApproval } from "../interfaces/orchestrator.interface";
import type { OrchestratorSessionMode } from "../utils/turn-context.helper";

@injectable()
export class OrchestratorController {
  constructor(
    private orchestratorService: OrchestratorService,
    private knowledgeService: OrchestratorKnowledgeService
  ) {}

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
      const body = req.validatedBody as {
        thread_id?: string;
        message: string;
        session_mode?: OrchestratorSessionMode;
        conversation_mode?: boolean;
        selection_context?: {
          blog_id: string;
          reference_type?: "highlight" | "blog";
          text?: string;
        };
        attachments?: Array<{
          name: string;
          url: string;
          mime_type: string;
          extracted_text?: string;
        }>;
      };
      const response = await this.orchestratorService.chat({
        siteId,
        userId,
        message: body.message,
        threadId: body.thread_id,
        requestId: getRequestIdFromHeaders(req),
        sessionMode: body.session_mode,
        conversationMode: body.conversation_mode,
        selectionContext: body.selection_context,
        attachments: body.attachments,
      });
      const requestId = getRequestIdFromHeaders(req);
      if (requestId) {
        res.setHeader("X-Request-Id", requestId);
      }
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
      const response = await this.orchestratorService.onboardingChat({
        siteId,
        userId,
        message,
        requestId: getRequestIdFromHeaders(req),
      });
      const requestId = getRequestIdFromHeaders(req);
      if (requestId) {
        res.setHeader("X-Request-Id", requestId);
      }
      sendSuccess(res, "OK", response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /sites/:siteId/orchestrator/onboarding/start
   * Appends the next brand-setup question as an assistant message (no LLM).
   */
  startOnboardingInterview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const response = await this.orchestratorService.startOnboardingInterview(siteId, userId);
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

  renameThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { siteId, threadId } = req.validatedParams as { siteId: string; threadId: string };
      const { title } = req.validatedBody as { title: string };
      const thread = await this.orchestratorService.renameThread(threadId, siteId, userId, title);
      sendSuccess(res, "Thread renamed", { thread });
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
      const approval = await this.orchestratorService.decideApproval(siteId, userId, approvalId, decision, note);
      sendCreated(res, "Approval decision recorded", { approval: serializeApproval(approval) });
    } catch (error) {
      next(error);
    }
  };

  uploadContextFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }
      const uploaded = await this.knowledgeService.uploadContextFile(file);
      sendCreated(res, "File uploaded", { file: uploaded });
    } catch (error) {
      next(error);
    }
  };

  listKnowledgeSources = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const sources = await this.knowledgeService.listSources(siteId);
      sendSuccess(res, "OK", { sources });
    } catch (error) {
      next(error);
    }
  };

  uploadKnowledgeSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }
      const result = await this.knowledgeService.uploadSource(siteId, userId, file);
      sendCreated(res, "Knowledge source added", result);
    } catch (error) {
      next(error);
    }
  };

  deleteKnowledgeSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const { id } = req.validatedParams as { id: string };
      await this.knowledgeService.deleteSource(siteId, id);
      sendSuccess(res, "Knowledge source removed", {});
    } catch (error) {
      next(error);
    }
  };

  googleDriveAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const authUrl = this.knowledgeService.getGoogleDriveAuthUrl(siteId);
      sendSuccess(res, "OK", { auth_url: authUrl });
    } catch (error) {
      next(error);
    }
  };
}
