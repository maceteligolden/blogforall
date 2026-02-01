import { injectable } from "tsyringe";
import Category, { Category as CategoryType } from "../../../shared/schemas/category.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";

@injectable()
export class CategoryRepository {
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  private async ensureUniqueSlug(slug: string, siteId: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existingCategory = await Category.findOne({
        site_id: siteId,
        slug: uniqueSlug,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      });

      if (!existingCategory) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async create(categoryData: Partial<CategoryType>): Promise<CategoryType> {
    const siteId = categoryData.site_id as string;
    const name = categoryData.name as string;

    // Generate slug
    const baseSlug = this.generateSlug(name);
    const slug = await this.ensureUniqueSlug(baseSlug, siteId);

    // Validate parent exists if provided
    if (categoryData.parent) {
      const parent = await Category.findOne({ _id: categoryData.parent, site_id: siteId });
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
    }

    const category = new Category({
      ...categoryData,
      slug,
    });
    return category.save();
  }

  async findById(id: string, siteId: string): Promise<CategoryType | null> {
    return Category.findOne({ _id: id, site_id: siteId });
  }

  async findBySite(siteId: string, filters?: { is_active?: boolean }): Promise<CategoryType[]> {
    const query: Record<string, unknown> = { site_id: siteId };
    if (filters?.is_active !== undefined) {
      query.is_active = filters.is_active;
    }
    return Category.find(query).sort({ name: 1 });
  }

  async findBySlug(slug: string, siteId: string): Promise<CategoryType | null> {
    return Category.findOne({ slug, site_id: siteId });
  }

  async findChildren(parentId: string, siteId: string): Promise<CategoryType[]> {
    return Category.find({ parent: parentId, site_id: siteId }).sort({ name: 1 });
  }

  async update(id: string, siteId: string, updateData: Partial<CategoryType>): Promise<CategoryType | null> {
    // If name is being updated, regenerate slug
    if (updateData.name) {
      const baseSlug = this.generateSlug(updateData.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, siteId, id);
    }

    // Validate parent exists if provided
    if (updateData.parent) {
      if (updateData.parent === id) {
        throw new BadRequestError("Category cannot be its own parent");
      }
      const parent = await Category.findOne({ _id: updateData.parent, site_id: siteId });
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }

      // Check for circular references
      const wouldCreateCycle = await this.wouldCreateCycle(id, updateData.parent, siteId);
      if (wouldCreateCycle) {
        throw new BadRequestError("Cannot create circular category reference");
      }
    }

    updateData.updated_at = new Date();
    return Category.findOneAndUpdate({ _id: id, site_id: siteId }, updateData, { new: true });
  }

  async delete(id: string, siteId: string): Promise<void> {
    // Check if category has children
    const children = await this.findChildren(id, siteId);
    if (children.length > 0) {
      throw new BadRequestError("Cannot delete category with child categories");
    }

    await Category.findOneAndDelete({ _id: id, site_id: siteId });
  }

  private async wouldCreateCycle(categoryId: string, newParentId: string, siteId: string): Promise<boolean> {
    let currentParentId: string | null | undefined = newParentId;
    const visited = new Set<string>([categoryId]);

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        return true; // Cycle detected
      }
      visited.add(currentParentId);

      const parent = await Category.findOne({ _id: currentParentId, site_id: siteId });
      if (!parent || !parent.parent) {
        break;
      }
      currentParentId = parent.parent as string | null | undefined;
    }

    return false;
  }

  async buildTree(categories: CategoryType[]): Promise<Array<CategoryType & { children?: CategoryType[] }>> {
    const categoryMap = new Map<string, CategoryType & { children?: CategoryType[] }>();
    const rootCategories: Array<CategoryType & { children?: CategoryType[] }> = [];

    // Create map of all categories
    categories.forEach((cat) => {
      const catObj = (cat as any).toObject ? (cat as any).toObject() : { ...(cat as any) };
      categoryMap.set(cat._id!.toString(), { ...catObj, children: [] });
    });

    // Build tree structure
    categories.forEach((cat) => {
      const category = categoryMap.get(cat._id!.toString());
      if (!category) return;

      if (cat.parent) {
        const parent = categoryMap.get(cat.parent);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(category);
        }
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }
}
