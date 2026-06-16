import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { CreateBlogInput } from "../interfaces/blog.interface";
import type { UpdateBlogInput } from "../interfaces/blog.interface";
import type { BlogQueryFilters } from "../interfaces/blog.interface";

@injectable()
export class BlogController {
  constructor(private blogService: BlogService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const validatedData = req.validatedBody as CreateBlogInput;
      const blog = await this.blogService.createBlog(userId, siteId, validatedData);
      sendCreated(res, "Blog created successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const blog = await this.blogService.getBlogById(id, siteId, userId);
      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug, siteId } = req.validatedParams as { siteId: string; slug: string };
      const blog = await this.blogService.getBlogBySlug(slug, siteId);
      await this.blogService.incrementViews(blog._id!.toString(), siteId);
      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getUserBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const validatedFilters = req.validatedQuery as BlogQueryFilters;
      const blogs = await this.blogService.getUserBlogs(userId, siteId, validatedFilters);
      sendSuccess(res, "Blogs retrieved successfully", blogs);
    } catch (error) {
      next(error);
    }
  };

  getAllBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const validatedFilters = req.validatedQuery as BlogQueryFilters;
      const result = await this.blogService.getAllBlogs(siteId, validatedFilters);
      sendSuccess(res, "Blogs retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const sanitized = req.validatedBody as UpdateBlogInput;
      const blog = await this.blogService.updateBlog(id, siteId, userId, sanitized);
      sendSuccess(res, "Blog updated successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      await this.blogService.deleteBlog(id, siteId, userId);
      sendNoContent(res, "Blog deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const blog = await this.blogService.publishBlog(id, siteId, userId);
      sendSuccess(res, "Blog published successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  unpublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const blog = await this.blogService.unpublishBlog(id, siteId, userId);
      sendSuccess(res, "Blog unpublished successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const userId = req.user?.userId;
      const userIdOrIp = userId || req.ip || req.socket.remoteAddress || "unknown";
      const result = await this.blogService.toggleLike(id, siteId, userIdOrIp);
      sendSuccess(res, "Like toggled successfully", result);
    } catch (error) {
      next(error);
    }
  };

  schedulePublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const validated = req.validatedBody as { scheduled_at: Date; timezone: string };
      const scheduled = await this.blogService.scheduleBlogPublish(id, siteId, userId, {
        scheduled_at: validated.scheduled_at,
        timezone: validated.timezone,
      });
      sendCreated(res, "Blog scheduled for publish", scheduled);
    } catch (error) {
      next(error);
    }
  };

  getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const schedule = await this.blogService.getBlogSchedule(id, siteId, userId);
      sendSuccess(res, schedule ? "Schedule retrieved" : "No schedule", schedule);
    } catch (error) {
      next(error);
    }
  };

  unschedulePublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      await this.blogService.unscheduleBlogPublish(id, siteId, userId);
      sendNoContent(res, "Blog unscheduled");
    } catch (error) {
      next(error);
    }
  };
}
