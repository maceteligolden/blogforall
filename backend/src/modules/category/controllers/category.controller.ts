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
      const category = await this.categoryService.createCategory(userId, validatedData);
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

      if (tree) {
        const categories = await this.categoryService.getUserCategoriesTree(userId, includeInactive);
        sendSuccess(res, "Categories retrieved successfully", categories);
      } else {
        const categories = await this.categoryService.getUserCategories(userId, includeInactive);
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
      const category = await this.categoryService.getCategoryById(id, userId);
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
      const category = await this.categoryService.updateCategory(id, userId, validatedData);
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
      await this.categoryService.deleteCategory(id, userId);
      sendNoContent(res, "Category deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}

