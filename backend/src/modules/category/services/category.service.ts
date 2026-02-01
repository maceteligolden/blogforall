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

  /**
   * Import categories from one site to another
   * Duplicates categories (including nested) maintaining parent-child relationships
   */
  async importCategories(
    sourceSiteId: string,
    targetSiteId: string,
    categoryIds: string[],
    userId: string
  ): Promise<Category[]> {
    if (categoryIds.length === 0) {
      throw new NotFoundError("No categories selected for import");
    }

    // Verify user has access to both sites
    // TODO: Add site access verification (task 17)
    
    // Get all categories from source site
    const sourceCategories = await this.categoryRepository.findBySite(sourceSiteId);
    
    // Filter to only selected categories and their descendants
    const categoriesToImport = this.getCategoriesWithDescendants(sourceCategories, categoryIds);
    
    if (categoriesToImport.length === 0) {
      throw new NotFoundError("No valid categories found to import");
    }

    // Create a map of old category ID to new category ID
    const categoryIdMap = new Map<string, string>();
    const importedCategories: Category[] = [];
    const categoriesToImportIds = new Set(categoriesToImport.map((cat) => cat._id!.toString()));

    // First pass: Import root categories (categories without parents or whose parents aren't in the import list)
    const rootCategories = categoriesToImport.filter(
      (cat) => !cat.parent || !categoriesToImportIds.has(cat.parent.toString())
    );

    for (const sourceCategory of rootCategories) {
      const newCategory = await this.categoryRepository.create({
        name: sourceCategory.name,
        description: sourceCategory.description,
        color: sourceCategory.color,
        is_active: sourceCategory.is_active,
        site_id: targetSiteId,
        parent: undefined, // Root category in target site
      });
      categoryIdMap.set(sourceCategory._id!.toString(), newCategory._id!.toString());
      importedCategories.push(newCategory);
    }

    // Second pass: Import nested categories recursively, level by level
    const remainingCategories = categoriesToImport.filter(
      (cat) => cat.parent && categoriesToImportIds.has(cat.parent.toString())
    );

    // Process categories level by level
    let currentLevel = remainingCategories.filter(
      (cat) => categoryIdMap.has(cat.parent!.toString())
    );

    while (currentLevel.length > 0) {
      const nextLevel: typeof remainingCategories = [];

      for (const sourceCategory of currentLevel) {
        const newParentId = categoryIdMap.get(sourceCategory.parent!.toString());
        if (!newParentId) {
          // Parent not imported yet, will be processed in next iteration
          continue;
        }

        const newCategory = await this.categoryRepository.create({
          name: sourceCategory.name,
          description: sourceCategory.description,
          color: sourceCategory.color,
          is_active: sourceCategory.is_active,
          site_id: targetSiteId,
          parent: newParentId,
        });
        categoryIdMap.set(sourceCategory._id!.toString(), newCategory._id!.toString());
        importedCategories.push(newCategory);

        // Find children of this category for next level
        const children = remainingCategories.filter(
          (cat) => cat.parent?.toString() === sourceCategory._id!.toString()
        );
        nextLevel.push(...children);
      }

      // Remove processed categories from remaining
      const processedIds = new Set(currentLevel.map((cat) => cat._id!.toString()));
      const stillRemaining = remainingCategories.filter(
        (cat) => !processedIds.has(cat._id!.toString())
      );

      // Get next level - categories whose parents are now in the map
      currentLevel = stillRemaining.filter((cat) => categoryIdMap.has(cat.parent!.toString()));
    }

    logger.info(
      "Categories imported",
      { sourceSiteId, targetSiteId, importedCount: importedCategories.length, userId },
      "CategoryService"
    );

    return importedCategories;
  }

  /**
   * Get categories and all their descendants
   */
  private getCategoriesWithDescendants(
    allCategories: Category[],
    categoryIds: string[]
  ): Category[] {
    const result: Category[] = [];
    const processed = new Set<string>();

    // Helper function to recursively add category and its children
    const addCategoryAndChildren = (categoryId: string) => {
      if (processed.has(categoryId)) {
        return;
      }

      const category = allCategories.find((cat) => cat._id!.toString() === categoryId);
      if (!category) {
        return;
      }

      result.push(category);
      processed.add(categoryId);

      // Find and add all children
      const children = allCategories.filter(
        (cat) => cat.parent?.toString() === categoryId
      );
      for (const child of children) {
        addCategoryAndChildren(child._id!.toString());
      }
    };

    // Start with selected categories
    for (const categoryId of categoryIds) {
      addCategoryAndChildren(categoryId);
    }

    return result;
  }
}
