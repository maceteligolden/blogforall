import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignService } from "../services/campaign.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { CampaignQueryFilters, CreateCampaignInput, UpdateCampaignInput } from "../interfaces/campaign.interface";

@injectable()
export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = req.validatedBody as CreateCampaignInput;
      const campaign = await this.campaignService.createCampaign(userId, siteId, body);
      sendCreated(res, "Campaign created successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const campaign = await this.campaignService.getCampaignById(id, siteId, userId);
      sendSuccess(res, "Campaign retrieved successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getByIdWithStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const campaign = await this.campaignService.getCampaignWithStats(id, siteId, userId);
      sendSuccess(res, "Campaign retrieved successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getUserCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const q = req.validatedQuery as CampaignQueryFilters;
      const campaigns = await this.campaignService.getCampaigns(userId, siteId, q);
      sendSuccess(res, "Campaigns retrieved successfully", campaigns);
    } catch (error) {
      next(error);
    }
  };

  getAllCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const filters = req.validatedQuery as CampaignQueryFilters;
      const result = await this.campaignService.getAllCampaigns(siteId, filters);
      sendSuccess(res, "Campaigns retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const body = req.validatedBody as UpdateCampaignInput;
      const campaign = await this.campaignService.updateCampaign(id, siteId, userId, body);
      sendSuccess(res, "Campaign updated successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      await this.campaignService.deleteCampaign(id, siteId, userId);
      sendNoContent(res, "Campaign deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const campaign = await this.campaignService.activateCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign activated successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  pause = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const campaign = await this.campaignService.pauseCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign paused successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const campaign = await this.campaignService.cancelCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign cancelled successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getByDateRange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const { start_date, end_date } = req.validatedQuery as { start_date: Date; end_date: Date };
      const campaigns = await this.campaignService.getCampaignsByDateRange(siteId, start_date, end_date);
      sendSuccess(res, "Campaigns retrieved successfully", campaigns);
    } catch (error) {
      next(error);
    }
  };
}
