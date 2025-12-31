import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createBlogSchema, updateBlogSchema, blogQuerySchema } from "../validations/blog.validation";

@injectable()
export class BlogController {
  constructor(private blogService: BlogService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const validatedData = createBlogSchema.parse(req.body);
      const blog = await this.blogService.createBlog(userId, validatedData);
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
      const blog = await this.blogService.getBlogById(id, userId);
      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug } = req.params;
      const blog = await this.blogService.getBlogBySlug(slug);
      await this.blogService.incrementViews(blog._id!.toString());
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

      const validatedFilters = blogQuerySchema.parse(req.query);
      const blogs = await this.blogService.getUserBlogs(userId, validatedFilters);
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
      const validatedFilters = blogQuerySchema.parse(req.query);
      const result = await this.blogService.getAllBlogs(validatedFilters);
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

      const validatedData = updateBlogSchema.parse(req.body);
      const blog = await this.blogService.updateBlog(id, userId, validatedData);
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

      await this.blogService.deleteBlog(id, userId);
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

      const blog = await this.blogService.publishBlog(id, userId);
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

      const blog = await this.blogService.unpublishBlog(id, userId);
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

      const result = await this.blogService.toggleLike(id, userIdOrIp);
      sendSuccess(res, "Like toggled successfully", result);
    } catch (error) {
      next(error);
    }
  };
}

