import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { CampaignPlanningService } from "../services/campaign-planning.service";
import { CampaignRoadmapService } from "../services/campaign-roadmap.service";
import { CampaignHealthService } from "../services/campaign-health.service";
import { CampaignProgressReportService } from "../services/campaign-progress-report.service";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { CampaignProgressReportRepository } from "../repositories/campaign-progress-report.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignMemoryService } from "../services/campaign-memory.service";
@injectable()
export class CampaignFeatureController {
  constructor(
    private planningService: CampaignPlanningService,
    private roadmapService: CampaignRoadmapService,
    private healthService: CampaignHealthService,
    private progressReportService: CampaignProgressReportService,
    private eventRepository: CampaignEventRepository,
    private progressReportRepository: CampaignProgressReportRepository,
    private campaignRepository: CampaignRepository,
    private memoryService: CampaignMemoryService
  ) {}

  private ids(req: Request) {
    const { siteId, id } = req.validatedParams as { siteId: string; id: string };
    return { siteId, campaignId: id, userId: getJwtUserId(req) };
  }

  plan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId, userId } = this.ids(req);
      const roadmap = await this.planningService.planCampaign(campaignId, siteId, userId);
      sendSuccess(res, "Campaign roadmap generated", roadmap);
    } catch (e) {
      next(e);
    }
  };

  getRoadmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const data = await this.roadmapService.getRoadmap(campaignId, siteId);
      sendSuccess(res, "Roadmap retrieved", data);
    } catch (e) {
      next(e);
    }
  };

  approveRoadmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId, userId } = this.ids(req);
      const data = await this.roadmapService.approveRoadmap(campaignId, siteId, userId);
      sendSuccess(res, "Roadmap approved and schedule materialized", data);
    } catch (e) {
      next(e);
    }
  };

  rejectRoadmap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId, userId } = this.ids(req);
      const body = (req.validatedBody ?? req.body) as { reason?: string };
      const data = await this.roadmapService.rejectRoadmap(
        campaignId,
        siteId,
        userId,
        body.reason
      );
      sendSuccess(res, "Roadmap rejected", data);
    } catch (e) {
      next(e);
    }
  };

  getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const health = await this.healthService.persist(campaignId, siteId);
      sendSuccess(res, "Campaign health", health);
    } catch (e) {
      next(e);
    }
  };

  getProgressLatest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const report = await this.progressReportService.getLatest(campaignId, siteId);
      sendSuccess(res, "Progress report", report);
    } catch (e) {
      next(e);
    }
  };

  generateProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const report = await this.progressReportService.buildDailyReport(campaignId, siteId);
      sendSuccess(res, "Progress report generated", report);
    } catch (e) {
      next(e);
    }
  };

  listProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const reports = await this.progressReportRepository.list(campaignId);
      if (reports.length === 0) {
        await this.progressReportService.buildDailyReport(campaignId, siteId);
      }
      sendSuccess(res, "Progress report history", await this.progressReportRepository.list(campaignId));
    } catch (e) {
      next(e);
    }
  };

  getMemory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = this.ids(req);
      const memory = await this.memoryService.get(campaignId, siteId);
      sendSuccess(res, "Campaign memory", memory);
    } catch (e) {
      next(e);
    }
  };

  listEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { campaignId } = this.ids(req);
      const events = await this.eventRepository.listByCampaign(campaignId);
      sendSuccess(res, "Campaign events", events);
    } catch (e) {
      next(e);
    }
  };

  siteReportsInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = (req.validatedParams as { siteId: string }).siteId;
      const dateStr = new Date().toISOString().slice(0, 10);
      const campaigns = await this.campaignRepository.findForDailyProgress(siteId);
      const reports = [];
      for (const c of campaigns) {
        let report = await this.progressReportRepository.findByDate(c._id!.toString(), dateStr);
        if (!report) {
          report = await this.progressReportService.buildDailyReport(
            c._id!.toString(),
            siteId,
            dateStr
          );
        }
        reports.push({ campaign: { _id: c._id, name: c.name }, report });
      }
      sendSuccess(res, "Site campaign reports", reports);
    } catch (e) {
      next(e);
    }
  };
}
