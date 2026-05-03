import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CategoryService } from "../services/category.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { CreateCategoryInput, UpdateCategoryInput } from "../interfaces/category.interface";

@injectable()
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const siteId = this.siteId(req);
      const validatedData = req.validatedBody as CreateCategoryInput;
      const category = await this.categoryService.createCategory(siteId, validatedData);
      sendCreated(res, "Category created successfully", category);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const siteId = this.siteId(req);
      const q = req.validatedQuery as { tree?: "true" | "false"; include_inactive?: "true" | "false" };
      const tree = q.tree === "true";
      const includeInactive = q.include_inactive === "true";

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
      getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const category = await this.categoryService.getCategoryById(id, siteId);
      sendSuccess(res, "Category retrieved successfully", category);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      const validatedData = req.validatedBody as UpdateCategoryInput;
      const category = await this.categoryService.updateCategory(id, siteId, validatedData);
      sendSuccess(res, "Category updated successfully", category);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const { id } = req.validatedParams as { siteId: string; id: string };
      const siteId = this.siteId(req);
      await this.categoryService.deleteCategory(id, siteId);
      sendNoContent(res, "Category deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  importCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const validatedData = req.validatedBody as {
        source_site_id: string;
        target_site_id: string;
        category_ids: string[];
      };
      const importedCategories = await this.categoryService.importCategories(
        validatedData.source_site_id,
        validatedData.target_site_id,
        validatedData.category_ids,
        userId
      );
      sendCreated(res, "Categories imported successfully", importedCategories);
    } catch (error) {
      next(error);
    }
  };
}
