import { injectable } from "tsyringe";
import { CategoryRepository } from "../repositories/category.repository";
import { NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateCategoryInput, UpdateCategoryInput, CategoryTreeItem } from "../interfaces/category.interface";
import { Category } from "../../../shared/schemas/category.schema";

@injectable()
export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  async createCategory(siteId: string, input: CreateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.create({
      ...input,
      site_id: siteId,
      is_active: true,
    });

    logger.info("Category created", { categoryId: category._id, siteId }, "CategoryService");
    return category;
  }

  async getCategoryById(categoryId: string, siteId: string): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId, siteId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  }

  async getSiteCategories(siteId: string, includeInactive = false): Promise<Category[]> {
    return this.categoryRepository.findBySite(siteId, {
      is_active: includeInactive ? undefined : true,
    });
  }

  async getSiteCategoriesTree(siteId: string, includeInactive = false): Promise<CategoryTreeItem[]> {
    const categories = await this.getSiteCategories(siteId, includeInactive);
    const tree = await this.categoryRepository.buildTree(categories);
    return tree as CategoryTreeItem[];
  }

  async updateCategory(categoryId: string, siteId: string, input: UpdateCategoryInput): Promise<Category> {
    const updatedCategory = await this.categoryRepository.update(categoryId, siteId, input);
    if (!updatedCategory) {
      throw new NotFoundError("Category not found");
    }

    logger.info("Category updated", { categoryId, siteId }, "CategoryService");
    return updatedCategory;
  }

  async deleteCategory(categoryId: string, siteId: string): Promise<void> {
    await this.categoryRepository.delete(categoryId, siteId);
    logger.info("Category deleted", { categoryId, siteId }, "CategoryService");
  }
}
