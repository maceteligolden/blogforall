import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ScheduledPostService } from "../services/scheduled-post.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { ScheduledPostQueryFilters } from "../interfaces/scheduled-post.interface";
import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";

@injectable()
export class ScheduledPostController {
  constructor(private scheduledPostService: ScheduledPostService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.body.site_id || (req.query.site_id as string);
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const scheduledPost = await this.scheduledPostService.createScheduledPost(userId, siteId, req.body);
      sendCreated(res, "Scheduled post created successfully", scheduledPost);
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

      const post = await this.scheduledPostService.getScheduledPostById(id, siteId, userId);
      sendSuccess(res, "Scheduled post retrieved successfully", post);
    } catch (error) {
      next(error);
    }
  };

  getUserScheduledPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const filters: ScheduledPostQueryFilters = {
        campaign_id: req.query.campaign_id as string | undefined,
        status: req.query.status as ScheduledPostStatus | undefined,
        scheduled_at_from: req.query.scheduled_at_from ? new Date(req.query.scheduled_at_from as string) : undefined,
        scheduled_at_to: req.query.scheduled_at_to ? new Date(req.query.scheduled_at_to as string) : undefined,
      };

      const posts = await this.scheduledPostService.getScheduledPosts(userId, siteId, filters);
      sendSuccess(res, "Scheduled posts retrieved successfully", posts);
    } catch (error) {
      next(error);
    }
  };

  getAllScheduledPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const filters: ScheduledPostQueryFilters = {
        campaign_id: req.query.campaign_id as string | undefined,
        status: req.query.status as ScheduledPostStatus | undefined,
        scheduled_at_from: req.query.scheduled_at_from ? new Date(req.query.scheduled_at_from as string) : undefined,
        scheduled_at_to: req.query.scheduled_at_to ? new Date(req.query.scheduled_at_to as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      };

      const result = await this.scheduledPostService.getAllScheduledPosts(siteId, filters);
      sendSuccess(res, "Scheduled posts retrieved successfully", result);
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
        return next(
          new BadRequestError("Valid start_date and end_date are required, and end_date must be after start_date")
        );
      }

      const posts = await this.scheduledPostService.getScheduledPostsByDateRange(siteId, startDate, endDate);
      sendSuccess(res, "Scheduled posts retrieved successfully", posts);
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

      const siteId = req.body.site_id || (req.query.site_id as string);
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const post = await this.scheduledPostService.updateScheduledPost(id, siteId, userId, req.body);
      sendSuccess(res, "Scheduled post updated successfully", post);
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

      await this.scheduledPostService.deleteScheduledPost(id, siteId, userId);
      sendNoContent(res, "Scheduled post deleted successfully");
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

      const post = await this.scheduledPostService.cancelScheduledPost(id, siteId, userId);
      sendSuccess(res, "Scheduled post cancelled successfully", post);
    } catch (error) {
      next(error);
    }
  };

  moveToCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.body.site_id || (req.query.site_id as string);
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const { campaign_id } = req.body;
      if (!campaign_id) {
        return next(new BadRequestError("Campaign ID is required"));
      }

      const post = await this.scheduledPostService.moveToCampaign(id, siteId, userId, campaign_id);
      sendSuccess(res, "Scheduled post moved to campaign successfully", post);
    } catch (error) {
      next(error);
    }
  };

  removeFromCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      const post = await this.scheduledPostService.removeFromCampaign(id, siteId, userId);
      sendSuccess(res, "Scheduled post removed from campaign successfully", post);
    } catch (error) {
      next(error);
    }
  };
}
