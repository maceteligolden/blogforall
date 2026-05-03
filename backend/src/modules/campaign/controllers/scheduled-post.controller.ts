import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ScheduledPostService } from "../services/scheduled-post.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type {
  CreateScheduledPostInput,
  UpdateScheduledPostInput,
  ScheduledPostQueryFilters,
} from "../interfaces/scheduled-post.interface";

@injectable()
export class ScheduledPostController {
  constructor(private scheduledPostService: ScheduledPostService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = req.validatedBody as CreateScheduledPostInput;
      const scheduledPost = await this.scheduledPostService.createScheduledPost(userId, siteId, body);
      sendCreated(res, "Scheduled post created successfully", scheduledPost);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const post = await this.scheduledPostService.getScheduledPostById(id, siteId, userId);
      sendSuccess(res, "Scheduled post retrieved successfully", post);
    } catch (error) {
      next(error);
    }
  };

  getUserScheduledPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const filters = req.validatedQuery as ScheduledPostQueryFilters;
      const posts = await this.scheduledPostService.getScheduledPosts(userId, siteId, filters);
      sendSuccess(res, "Scheduled posts retrieved successfully", posts);
    } catch (error) {
      next(error);
    }
  };

  getAllScheduledPosts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const filters = req.validatedQuery as ScheduledPostQueryFilters;
      const result = await this.scheduledPostService.getAllScheduledPosts(siteId, filters);
      sendSuccess(res, "Scheduled posts retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getByDateRange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const { start_date, end_date } = req.validatedQuery as { start_date: Date; end_date: Date };
      const posts = await this.scheduledPostService.getScheduledPostsByDateRange(siteId, start_date, end_date);
      sendSuccess(res, "Scheduled posts retrieved successfully", posts);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const body = req.validatedBody as UpdateScheduledPostInput;
      const post = await this.scheduledPostService.updateScheduledPost(id, siteId, userId, body);
      sendSuccess(res, "Scheduled post updated successfully", post);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      await this.scheduledPostService.deleteScheduledPost(id, siteId, userId);
      sendNoContent(res, "Scheduled post deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const post = await this.scheduledPostService.cancelScheduledPost(id, siteId, userId);
      sendSuccess(res, "Scheduled post cancelled successfully", post);
    } catch (error) {
      next(error);
    }
  };

  moveToCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const { campaign_id } = req.validatedBody as { campaign_id: string };
      const post = await this.scheduledPostService.moveToCampaign(id, siteId, userId, campaign_id);
      sendSuccess(res, "Scheduled post moved to campaign successfully", post);
    } catch (error) {
      next(error);
    }
  };

  removeFromCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const post = await this.scheduledPostService.removeFromCampaign(id, siteId, userId);
      sendSuccess(res, "Scheduled post removed from campaign successfully", post);
    } catch (error) {
      next(error);
    }
  };
}
