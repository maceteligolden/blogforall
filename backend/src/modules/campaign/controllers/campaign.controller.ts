import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignService } from "../services/campaign.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { CampaignQueryFilters } from "../interfaces/campaign.interface";
import { CampaignStatus } from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.body.site_id || req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.createCampaign(userId, siteId, req.body);
      sendCreated(res, "Campaign created successfully", campaign);
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
      const userId = req.user?.userId;
      const siteId = req.query.site_id as string;
      
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.getCampaignById(id, siteId, userId);
      sendSuccess(res, "Campaign retrieved successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getByIdWithStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const siteId = req.query.site_id as string;
      
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.getCampaignWithStats(id, siteId, userId);
      sendSuccess(res, "Campaign retrieved successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getUserCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const filters: CampaignQueryFilters = {
        status: req.query.status as CampaignStatus | undefined,
        search: req.query.search as string | undefined,
        start_date_from: req.query.start_date_from ? new Date(req.query.start_date_from as string) : undefined,
        start_date_to: req.query.start_date_to ? new Date(req.query.start_date_to as string) : undefined,
      };

      const campaigns = await this.campaignService.getCampaigns(userId, siteId, filters);
      sendSuccess(res, "Campaigns retrieved successfully", campaigns);
    } catch (error) {
      next(error);
    }
  };

  getAllCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const filters: CampaignQueryFilters = {
        status: req.query.status as CampaignStatus | undefined,
        search: req.query.search as string | undefined,
        start_date_from: req.query.start_date_from ? new Date(req.query.start_date_from as string) : undefined,
        start_date_to: req.query.start_date_to ? new Date(req.query.start_date_to as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      const result = await this.campaignService.getAllCampaigns(siteId, filters);
      sendSuccess(res, "Campaigns retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.body.site_id || req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.updateCampaign(id, siteId, userId, req.body);
      sendSuccess(res, "Campaign updated successfully", campaign);
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
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      await this.campaignService.deleteCampaign(id, siteId, userId);
      sendNoContent(res, "Campaign deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.activateCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign activated successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  pause = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.pauseCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign paused successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const campaign = await this.campaignService.cancelCampaign(id, siteId, userId);
      sendSuccess(res, "Campaign cancelled successfully", campaign);
    } catch (error) {
      next(error);
    }
  };

  getByDateRange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const startDate = req.query.start_date ? new Date(req.query.start_date as string) : new Date();
      const endDate = req.query.end_date ? new Date(req.query.end_date as string) : new Date();

      if (!startDate || !endDate || startDate >= endDate) {
        return next(new BadRequestError("Valid start_date and end_date are required, and end_date must be after start_date"));
      }

      const campaigns = await this.campaignService.getCampaignsByDateRange(siteId, startDate, endDate);
      sendSuccess(res, "Campaigns retrieved successfully", campaigns);
    } catch (error) {
      next(error);
    }
  };
}
