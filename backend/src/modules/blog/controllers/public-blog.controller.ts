import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import type { BlogQueryFilters } from "../interfaces/blog.interface";

@injectable()
export class PublicBlogController {
  constructor(private blogService: BlogService) {}

  getPublishedBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = req.accessKeyId;
    try {
      const userId = req.user?.userId;
      const siteId = req.user?.workspaceSiteId;
      if (!userId || !siteId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const validatedFilters = req.validatedQuery as BlogQueryFilters;

      logger.info(
        "Service call: getPublishedBlogs",
        {
          accessKeyId,
          userId,
          siteId,
          filters: validatedFilters,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const result = await this.blogService.getPublishedBlogs(siteId, validatedFilters);
      const duration = Date.now() - startTime;

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

  getCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = req.accessKeyId;
    try {
      const userId = req.user?.userId;
      const siteId = req.user?.workspaceSiteId;
      if (!userId || !siteId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { container } = await import("tsyringe");
      const { CategoryService } = await import("../../category/services/category.service");
      const categoryService = container.resolve(CategoryService);

      const q = req.validatedQuery as { tree?: "true" | "false"; include_inactive?: "true" | "false" };
      const tree = q.tree === "true";
      const includeInactive = q.include_inactive === "true";

      logger.info(
        "Service call: getCategories",
        {
          accessKeyId,
          userId,
          siteId,
          tree,
          includeInactive,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );
      let categories;
      if (tree) {
        categories = await categoryService.getSiteCategoriesTree(siteId, includeInactive);
      } else {
        categories = await categoryService.getSiteCategories(siteId, includeInactive);
      }

      const duration = Date.now() - startTime;

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

  getBlogsByCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = req.accessKeyId;
    try {
      const userId = req.user?.userId;
      const siteId = req.user?.workspaceSiteId;
      if (!userId || !siteId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { categoryId } = req.validatedParams as { categoryId: string };
      const validatedFilters = req.validatedQuery as BlogQueryFilters;

      logger.info(
        "Service call: getBlogsByCategory",
        {
          accessKeyId,
          userId,
          siteId,
          categoryId,
          filters: validatedFilters,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const result = await this.blogService.getPublishedBlogs(siteId, {
        ...validatedFilters,
        category: categoryId,
      });

      const duration = Date.now() - startTime;

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
      logger.error(
        "Error in getBlogsByCategory",
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

  getPublishedBlogById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = req.accessKeyId;
    try {
      const userId = req.user?.userId;
      const siteId = req.user?.workspaceSiteId;
      if (!userId || !siteId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { id } = req.validatedParams as { id: string };

      logger.info(
        "Service call: getPublishedBlogById",
        {
          accessKeyId,
          userId,
          siteId,
          blogId: id,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const blog = await this.blogService.getBlogById(id, siteId);

      if (blog.status !== "published") {
        logger.warn(
          "Blog not published or not found",
          {
            accessKeyId,
            userId,
            siteId,
            blogId: id,
            status: blog.status,
          },
          "PublicBlogController"
        );
        return next(new BadRequestError("Blog not found or not published"));
      }

      await this.blogService.incrementViews(blog._id!.toString(), siteId);

      const duration = Date.now() - startTime;

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
          blogId: (req.validatedParams as { id?: string })?.id,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };

  getPublishedBlogBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const accessKeyId = req.accessKeyId;
    try {
      const userId = req.user?.userId;
      const siteId = req.user?.workspaceSiteId;
      if (!userId || !siteId) {
        return next(new BadRequestError("API key authentication required"));
      }

      const { slug } = req.validatedParams as { slug: string };

      logger.info(
        "Service call: getPublishedBlogBySlug",
        {
          accessKeyId,
          userId,
          siteId,
          slug,
          method: req.method,
          path: req.path,
        },
        "PublicBlogController"
      );

      const blog = await this.blogService.getBlogBySlug(slug, siteId);

      if (blog.status !== "published") {
        logger.warn(
          "Blog not published or not found",
          {
            accessKeyId,
            userId,
            siteId,
            slug,
            status: blog.status,
          },
          "PublicBlogController"
        );
        return next(new BadRequestError("Blog not found or not published"));
      }

      await this.blogService.incrementViews(blog._id!.toString(), siteId);

      const duration = Date.now() - startTime;

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
          slug: (req.validatedParams as { slug?: string })?.slug,
          duration: `${duration}ms`,
        },
        "PublicBlogController"
      );
      next(error);
    }
  };
}
