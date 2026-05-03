import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignAgentService } from "../services/campaign-agent.service";
import { sendSuccess, sendCreated } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { AgentProposal } from "../interfaces/campaign-agent.interface";

@injectable()
export class CampaignAgentController {
  constructor(private campaignAgentService: CampaignAgentService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const {
        session_id: sessionId,
        message,
        site_id: siteIdFromBody,
      } = req.validatedBody as {
        session_id?: string;
        message: string;
        site_id?: string;
      };
      const siteId = siteIdFromBody ?? this.siteId(req);
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
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const { proposal } = req.validatedBody as { proposal: AgentProposal };
      const result = await this.campaignAgentService.createFromProposal(userId, siteId, proposal);
      sendCreated(res, "Campaign and scheduled posts created", result);
    } catch (error) {
      next(error);
    }
  };
}
