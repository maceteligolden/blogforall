import { injectable } from "tsyringe";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { Category as CategoryType } from "../../../shared/schemas/category.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { db } from "../../../shared/database";
import { categories } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class CategoryRepository {
  private toEntity(row: typeof categories.$inferSelect): CategoryType {
    return withId(row) as unknown as CategoryType;
  }

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
      const filters = [eq(categories.site_id, siteId), eq(categories.slug, uniqueSlug)];
      if (excludeId) {
        filters.push(ne(categories.id, excludeId));
      }
      const [existingCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(...filters))
        .limit(1);

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

    const baseSlug = this.generateSlug(name);
    const slug = await this.ensureUniqueSlug(baseSlug, siteId);

    if (categoryData.parent) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, categoryData.parent), eq(categories.site_id, siteId)))
        .limit(1);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }
    }

    const { _id: _ignored, id: _idIgnored, ...rest } = categoryData as Partial<CategoryType> & { id?: string };
    const [row] = await db
      .insert(categories)
      .values({
        site_id: siteId,
        name,
        slug,
        ...omitUndefined({
          description: rest.description,
          parent: rest.parent,
          color: rest.color,
          is_active: rest.is_active,
        } as Record<string, unknown>),
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string, siteId: string): Promise<CategoryType | null> {
    const [row] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.site_id, siteId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findBySite(siteId: string, filters?: { is_active?: boolean }): Promise<CategoryType[]> {
    const conditions = [eq(categories.site_id, siteId)];
    if (filters?.is_active !== undefined) {
      conditions.push(eq(categories.is_active, filters.is_active));
    }
    const rows = await db
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(asc(categories.name));
    return withIds(rows) as unknown as CategoryType[];
  }

  async countBySiteIds(siteIds: string[]): Promise<Record<string, number>> {
    if (!siteIds.length) return {};
    const rows = await db
      .select({ site_id: categories.site_id, count: sql<number>`count(*)` })
      .from(categories)
      .where(inArray(categories.site_id, siteIds))
      .groupBy(categories.site_id);
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.site_id] = Number(row.count);
      return acc;
    }, {});
  }

  async findBySlug(slug: string, siteId: string): Promise<CategoryType | null> {
    const [row] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.site_id, siteId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findChildren(parentId: string, siteId: string): Promise<CategoryType[]> {
    const rows = await db
      .select()
      .from(categories)
      .where(and(eq(categories.parent, parentId), eq(categories.site_id, siteId)))
      .orderBy(asc(categories.name));
    return withIds(rows) as unknown as CategoryType[];
  }

  async update(id: string, siteId: string, updateData: Partial<CategoryType>): Promise<CategoryType | null> {
    if (updateData.name) {
      const baseSlug = this.generateSlug(updateData.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, siteId, id);
    }

    if (updateData.parent) {
      if (updateData.parent === id) {
        throw new BadRequestError("Category cannot be its own parent");
      }
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, updateData.parent), eq(categories.site_id, siteId)))
        .limit(1);
      if (!parent) {
        throw new NotFoundError("Parent category not found");
      }

      const wouldCreateCycle = await this.wouldCreateCycle(id, updateData.parent, siteId);
      if (wouldCreateCycle) {
        throw new BadRequestError("Cannot create circular category reference");
      }
    }

    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<CategoryType> & { id?: string };
    const [row] = await db
      .update(categories)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(and(eq(categories.id, id), eq(categories.site_id, siteId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string, siteId: string): Promise<void> {
    const children = await this.findChildren(id, siteId);
    if (children.length > 0) {
      throw new BadRequestError("Cannot delete category with child categories");
    }

    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.site_id, siteId)));
  }

  private async wouldCreateCycle(categoryId: string, newParentId: string, siteId: string): Promise<boolean> {
    let currentParentId: string | null | undefined = newParentId;
    const visited = new Set<string>([categoryId]);

    while (currentParentId) {
      if (visited.has(currentParentId)) {
        return true;
      }
      visited.add(currentParentId);

      const [parent] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.id, currentParentId), eq(categories.site_id, siteId)))
        .limit(1);
      if (!parent || !parent.parent) {
        break;
      }
      currentParentId = parent.parent;
    }

    return false;
  }

  async buildTree(categoryList: CategoryType[]): Promise<Array<CategoryType & { children?: CategoryType[] }>> {
    const categoryMap = new Map<string, CategoryType & { children?: CategoryType[] }>();
    const rootCategories: Array<CategoryType & { children?: CategoryType[] }> = [];

    categoryList.forEach((cat) => {
      categoryMap.set(cat._id!.toString(), { ...cat, children: [] });
    });

    categoryList.forEach((cat) => {
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
