import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { blogQuerySchema } from "../validations/blog.validation";
import { logger } from "../../../shared/utils/logger";

@injectable()
export class PublicBlogController {
  constructor(private blogService: BlogService) {}

  /**
   * Get all published blogs with pagination, search, and filtering
   * Requires API key authentication
   */
  getPublishedBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = (req as any).accessKeyId;
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const validatedFilters = blogQuerySchema.parse(req.query);

      // Log service call
      logger.info(
        "Service call: getPublishedBlogs",
        {
          accessKeyId,
          userId,
          filters: validatedFilters,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const result = await this.blogService.getPublishedBlogs(validatedFilters);

      const duration = Date.now() - startTime;

      // Log service response
      logger.info(
        "Service response: getPublishedBlogs",
        {
          accessKeyId,
          userId,
          blogsCount: result.data.length,
          totalBlogs: result.pagination.total,
          page: result.pagination.page,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );

      sendSuccess(res, "Published blogs retrieved successfully", result);
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof ZodError) {
        logger.warn(
          "Validation error in getPublishedBlogs",
          {
            accessKeyId,
            errors: error.errors,
            duration: `${duration}ms`,
          },
          "PublicBlogController"
        );
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      logger.error(
        "Error in getPublishedBlogs",
        error as Error,
        {
          accessKeyId,
          userId: req.user?.userId,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };

  /**
   * Get all categories for the authenticated user
   * Requires API key authentication
   */
  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = (req as any).accessKeyId;
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

      // Log service call
      logger.info(
        "Service call: getCategories",
        {
          accessKeyId,
          userId,
          tree,
          includeInactive,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      let categories;
      if (tree) {
        categories = await categoryService.getUserCategoriesTree(userId, includeInactive);
      } else {
        categories = await categoryService.getUserCategories(userId, includeInactive);
      }

      const duration = Date.now() - startTime;

      // Log service response
      logger.info(
        "Service response: getCategories",
        {
          accessKeyId,
          userId,
          categoriesCount: Array.isArray(categories) ? categories.length : 0,
          tree,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );

      sendSuccess(res, "Categories retrieved successfully", categories);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error in getCategories",
        error as Error,
        {
          accessKeyId,
          userId: req.user?.userId,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };

  /**
   * Get published blogs by category
   * Requires API key authentication
   */
  getBlogsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = (req as any).accessKeyId;
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { categoryId } = req.params;
      const validatedFilters = blogQuerySchema.parse(req.query);

      // Log service call
      logger.info(
        "Service call: getBlogsByCategory",
        {
          accessKeyId,
          userId,
          categoryId,
          filters: validatedFilters,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const result = await this.blogService.getPublishedBlogs({
        ...validatedFilters,
        category: categoryId,
      });

      const duration = Date.now() - startTime;

      // Log service response
      logger.info(
        "Service response: getBlogsByCategory",
        {
          accessKeyId,
          userId,
          categoryId,
          blogsCount: result.data.length,
          totalBlogs: result.pagination.total,
          page: result.pagination.page,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );

      sendSuccess(res, "Published blogs retrieved successfully", result);
    } catch (error) {
      const duration = Date.now() - startTime;
      if (error instanceof ZodError) {
        logger.warn(
          "Validation error in getBlogsByCategory",
          {
            accessKeyId,
            categoryId: req.params.categoryId,
            errors: error.errors,
            duration: `${duration}ms`,
          },
          "PublicBlogController"
        );
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      logger.error(
        "Error in getBlogsByCategory",
        error as Error,
        {
          accessKeyId,
          userId: req.user?.userId,
          categoryId: req.params.categoryId,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };

  /**
   * Get a single published blog by ID
   * Requires API key authentication
   */
  getPublishedBlogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = (req as any).accessKeyId;
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { id } = req.params;

      // Log service call
      logger.info(
        "Service call: getPublishedBlogById",
        {
          accessKeyId,
          userId,
          blogId: id,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const blog = await this.blogService.getBlogById(id);

      // Only return published blogs
      if (blog.status !== "published") {
        logger.warn(
          "Blog not published or not found",
          {
            accessKeyId,
            userId,
            blogId: id,
            status: blog.status,
          },
          "PublicBlogController"
        );
        return next(new BadRequestError("Blog not found or not published"));
      }

      // Increment views
      await this.blogService.incrementViews(blog._id!.toString());

      const duration = Date.now() - startTime;

      // Log service response
      logger.info(
        "Service response: getPublishedBlogById",
        {
          accessKeyId,
          userId,
          blogId: id,
          blogTitle: blog.title,
          views: blog.views,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );

      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error in getPublishedBlogById",
        error as Error,
        {
          accessKeyId,
          userId: req.user?.userId,
          blogId: req.params.id,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };

  /**
   * Get a single published blog by slug
   * Requires API key authentication
   */
  getPublishedBlogBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = (req as any).accessKeyId;
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { slug } = req.params;

      // Log service call
      logger.info(
        "Service call: getPublishedBlogBySlug",
        {
          accessKeyId,
          userId,
          slug,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const blog = await this.blogService.getBlogBySlug(slug);

      // Only return published blogs
      if (blog.status !== "published") {
        logger.warn(
          "Blog not published or not found",
          {
            accessKeyId,
            userId,
            slug,
            status: blog.status,
          },
          "PublicBlogController"
        );
        return next(new BadRequestError("Blog not found or not published"));
      }

      // Increment views
      await this.blogService.incrementViews(blog._id!.toString());

      const duration = Date.now() - startTime;

      // Log service response
      logger.info(
        "Service response: getPublishedBlogBySlug",
        {
          accessKeyId,
          userId,
          slug,
          blogId: blog._id?.toString(),
          blogTitle: blog.title,
          views: blog.views,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );

      sendSuccess(res, "Blog retrieved successfully", blog);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        "Error in getPublishedBlogBySlug",
        error as Error,
        {
          accessKeyId,
          userId: req.user?.userId,
          slug: req.params.slug,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };
}
