import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CategoryService } from "../services/category.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createCategorySchema, updateCategorySchema } from "../validations/category.validation";

@injectable()
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const validatedData = createCategorySchema.parse(req.body);
      // TODO: Update to use siteId from request context (task 15)
      const siteId = userId; // Temporary - will be replaced with actual siteId
      const category = await this.categoryService.createCategory(siteId, validatedData);
      sendCreated(res, "Category created successfully", category);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const tree = req.query.tree === "true";
      const includeInactive = req.query.include_inactive === "true";

      // TODO: Update to use siteId from request context (task 15)
      // For now, using userId as placeholder - will be replaced with siteId
      const siteId = userId; // Temporary - will be replaced with actual siteId
      if (tree) {
        const categories = await this.categoryService.getSiteCategoriesTree(siteId, includeInactive);
        sendSuccess(res, "Categories retrieved successfully", categories);
      } else {
        const categories = await this.categoryService.getSiteCategories(siteId, includeInactive);
        sendSuccess(res, "Categories retrieved successfully", categories);
      }
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      // TODO: Update to use siteId from request context (task 15)
      const siteId = userId; // Temporary - will be replaced with actual siteId
      const category = await this.categoryService.getCategoryById(id, siteId);
      sendSuccess(res, "Category retrieved successfully", category);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      const validatedData = updateCategorySchema.parse(req.body);
      // TODO: Update to use siteId from request context (task 15)
      const siteId = userId; // Temporary - will be replaced with actual siteId
      const category = await this.categoryService.updateCategory(id, siteId, validatedData);
      sendSuccess(res, "Category updated successfully", category);
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
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      // TODO: Update to use siteId from request context (task 15)
      const siteId = userId; // Temporary - will be replaced with actual siteId
      await this.categoryService.deleteCategory(id, siteId);
      sendNoContent(res, "Category deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}
