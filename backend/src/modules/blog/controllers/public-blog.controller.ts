import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { blogQuerySchema } from "../validations/blog.validation";

@injectable()
export class PublicBlogController {
  constructor(private blogService: BlogService) {}

  /**
   * Get all published blogs with pagination, search, and filtering
   * Requires API key authentication
   */
  getPublishedBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const validatedFilters = blogQuerySchema.parse(req.query);
      const result = await this.blogService.getPublishedBlogs(validatedFilters);
      sendSuccess(res, "Published blogs retrieved successfully", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  /**
   * Get all categories for the authenticated user
   * Requires API key authentication
   */
  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { container } = await import("tsyringe");
      const { CategoryService } = await import("../../category/services/category.service");
      const categoryService = container.resolve(CategoryService);

      const tree = req.query.tree === "true";
      const includeInactive = req.query.include_inactive === "true";

      if (tree) {
        const categories = await categoryService.getUserCategoriesTree(userId, includeInactive);
        sendSuccess(res, "Categories retrieved successfully", categories);
      } else {
        const categories = await categoryService.getUserCategories(userId, includeInactive);
        sendSuccess(res, "Categories retrieved successfully", categories);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get published blogs by category
   * Requires API key authentication
   */
  getBlogsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { categoryId } = req.params;
      const validatedFilters = blogQuerySchema.parse(req.query);
      const result = await this.blogService.getPublishedBlogs({
        ...validatedFilters,
        category: categoryId,
      });
      sendSuccess(res, "Published blogs retrieved successfully", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  /**
   * Get a single published blog by ID
   * Requires API key authentication
   */
  getPublishedBlogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { id } = req.params;
      const blog = await this.blogService.getBlogById(id);

      // Only return published blogs
      if (blog.status !== "published") {
        return next(new BadRequestError("Blog not found or not published"));
      }

      // Increment views
      await this.blogService.incrementViews(blog._id!.toString());

      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get a single published blog by slug
   * Requires API key authentication
   */
  getPublishedBlogBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { slug } = req.params;
      const blog = await this.blogService.getBlogBySlug(slug);

      // Only return published blogs
      if (blog.status !== "published") {
        return next(new BadRequestError("Blog not found or not published"));
      }

      // Increment views
      await this.blogService.incrementViews(blog._id!.toString());

      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      next(error);
    }
  };
}

