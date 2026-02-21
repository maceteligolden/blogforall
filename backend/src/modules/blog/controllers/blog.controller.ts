import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { SiteService } from "../../site/services/site.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import {
  createBlogSchema,
  updateBlogSchema,
  blogQuerySchema,
  scheduleBlogSchema,
} from "../validations/blog.validation";

@injectable()
export class BlogController {
  constructor(
    private blogService: BlogService,
    private siteService: SiteService
  ) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      // TODO: Get siteId from request context (task 20)
      // For now, getting from body or query - will be replaced with site context middleware
      const siteId = req.body.site_id || (req.query.site_id as string);
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const validatedData = createBlogSchema.parse(req.body);
      const blog = await this.blogService.createBlog(userId, siteId, validatedData);
      sendCreated(res, "Blog created successfully", blog);
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

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const blog = await this.blogService.getBlogById(id, siteId, userId);
      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug } = req.params;

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const blog = await this.blogService.getBlogBySlug(slug, siteId);
      await this.blogService.incrementViews(blog._id!.toString(), siteId);
      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getUserBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      // Use site_id from query, or fall back to user's first site when missing (e.g. frontend before store rehydration)
      let siteId = req.query.site_id as string;
      if (!siteId) {
        const userSites = await this.siteService.getSitesByUser(userId);
        siteId = userSites.length > 0 ? userSites[0]._id!.toString() : "";
        if (!siteId) {
          return next(new BadRequestError("No site found. Create a site first."));
        }
      }

      const validatedFilters = blogQuerySchema.parse(req.query);
      const blogs = await this.blogService.getUserBlogs(userId, siteId, validatedFilters);
      sendSuccess(res, "Blogs retrieved successfully", blogs);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getAllBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const validatedFilters = blogQuerySchema.parse(req.query);
      const result = await this.blogService.getAllBlogs(siteId, validatedFilters);
      sendSuccess(res, "Blogs retrieved successfully", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
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

      // TODO: Get siteId from request context (task 20)
      const siteId = req.body.site_id || (req.query.site_id as string);
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const validatedData = updateBlogSchema.parse(req.body);
      const blog = await this.blogService.updateBlog(id, siteId, userId, validatedData);
      sendSuccess(res, "Blog updated successfully", blog);
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

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      await this.blogService.deleteBlog(id, siteId, userId);
      sendNoContent(res, "Blog deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const blog = await this.blogService.publishBlog(id, siteId, userId);
      sendSuccess(res, "Blog published successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  unpublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const blog = await this.blogService.unpublishBlog(id, siteId, userId);
      sendSuccess(res, "Blog unpublished successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const userIdOrIp = userId || req.ip || req.socket.remoteAddress || "unknown";

      // TODO: Get siteId from request context (task 20)
      const siteId = req.query.site_id as string;
      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      const result = await this.blogService.toggleLike(id, siteId, userIdOrIp);
      sendSuccess(res, "Like toggled successfully", result);
    } catch (error) {
      next(error);
    }
  };

  schedulePublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      const validated = scheduleBlogSchema.parse(req.body);
      const scheduled = await this.blogService.scheduleBlogPublish(id, siteId, userId, {
        scheduled_at: validated.scheduled_at,
        timezone: validated.timezone,
      });
      sendCreated(res, "Blog scheduled for publish", scheduled);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getSchedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      const schedule = await this.blogService.getBlogSchedule(id, siteId, userId);
      sendSuccess(res, schedule ? "Schedule retrieved" : "No schedule", schedule);
    } catch (error) {
      next(error);
    }
  };

  unschedulePublish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      await this.blogService.unscheduleBlogPublish(id, siteId, userId);
      sendNoContent(res, "Blog unscheduled");
    } catch (error) {
      next(error);
    }
  };
}
