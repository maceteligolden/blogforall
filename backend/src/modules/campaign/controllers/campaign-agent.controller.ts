import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignAgentService } from "../services/campaign-agent.service";
import { sendSuccess, sendCreated } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import type { AgentProposal } from "../interfaces/campaign-agent.interface";

@injectable()
export class CampaignAgentController {
  constructor(private campaignAgentService: CampaignAgentService) {}

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const {
        session_id: sessionId,
        message,
        site_id: siteId,
      } = req.body as {
        session_id?: string;
        message?: string;
        site_id?: string;
      };
      if (!message || typeof message !== "string") {
        return next(new BadRequestError("message is required"));
      }
      const result = await this.campaignAgentService.chat({
        sessionId,
        siteId,
        userId,
        message,
      });
      sendSuccess(res, "OK", result);
    } catch (error) {
      next(error);
    }
  };

  createFromProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const siteId = (req.body.site_id ?? req.query.site_id) as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }
      const proposal = req.body.proposal as AgentProposal | undefined;
      if (!proposal?.campaign || !Array.isArray(proposal.scheduled_posts)) {
        return next(new BadRequestError("proposal with campaign and scheduled_posts is required"));
      }
      const result = await this.campaignAgentService.createFromProposal(userId, siteId, proposal);
      sendCreated(res, "Campaign and scheduled posts created", result);
    } catch (error) {
      next(error);
    }
  };
}
