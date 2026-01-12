import { injectable } from "tsyringe";
import { CategoryRepository } from "../repositories/category.repository";
import { NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateCategoryInput, UpdateCategoryInput, CategoryTreeItem } from "../interfaces/category.interface";
import { Category } from "../../../shared/schemas/category.schema";

@injectable()
export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  async createCategory(userId: string, input: CreateCategoryInput): Promise<Category> {
    const category = await this.categoryRepository.create({
      ...input,
      user: userId,
      is_active: true,
    });

    logger.info("Category created", { categoryId: category._id, userId }, "CategoryService");
    return category;
  }

  async getCategoryById(categoryId: string, userId: string): Promise<Category> {
    const category = await this.categoryRepository.findById(categoryId, userId);
    if (!category) {
      throw new NotFoundError("Category not found");
    }
    return category;
  }

  async getUserCategories(userId: string, includeInactive = false): Promise<Category[]> {
    return this.categoryRepository.findByUser(userId, {
      is_active: includeInactive ? undefined : true,
    });
  }

  async getUserCategoriesTree(userId: string, includeInactive = false): Promise<CategoryTreeItem[]> {
    const categories = await this.getUserCategories(userId, includeInactive);
    const tree = await this.categoryRepository.buildTree(categories);
    return tree as CategoryTreeItem[];
  }

  async updateCategory(categoryId: string, userId: string, input: UpdateCategoryInput): Promise<Category> {
    const updatedCategory = await this.categoryRepository.update(categoryId, userId, input);
    if (!updatedCategory) {
      throw new NotFoundError("Category not found");
    }

    logger.info("Category updated", { categoryId, userId }, "CategoryService");
    return updatedCategory;
  }

  async deleteCategory(categoryId: string, userId: string): Promise<void> {
    await this.categoryRepository.delete(categoryId, userId);
    logger.info("Category deleted", { categoryId, userId }, "CategoryService");
  }
}
