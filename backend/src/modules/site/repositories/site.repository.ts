import { injectable } from "tsyringe";
import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { Site as SiteType } from "../../../shared/schemas/site.schema";
import { generateSitePublicId } from "../../../shared/utils/site-public-id";
import { db, withTransaction } from "../../../shared/database";
import { sites, siteMembers } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";
import { SiteMemberRole } from "../../../shared/constants";

@injectable()
export class SiteRepository {
  private toEntity(row: typeof sites.$inferSelect): SiteType {
    return withId(row) as unknown as SiteType;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async ensureUniqueSlug(slug: string, excludeId?: string, executor: typeof db = db): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const conditions = [eq(sites.slug, uniqueSlug)];
      if (excludeId) {
        conditions.push(ne(sites.id, excludeId));
      }
      const [existing] = await executor
        .select({ id: sites.id })
        .from(sites)
        .where(and(...conditions))
        .limit(1);
      if (!existing) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  async create(siteData: Partial<SiteType>): Promise<SiteType> {
    const name = siteData.name as string;

    let baseSlug = this.generateSlug(name);
    if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
      baseSlug = "site";
    }
    const slug = await this.ensureUniqueSlug(baseSlug);

    let public_id = generateSitePublicId();
    for (let i = 0; i < 8; i++) {
      const [taken] = await db.select({ id: sites.id }).from(sites).where(eq(sites.public_id, public_id)).limit(1);
      if (!taken) break;
      public_id = generateSitePublicId();
    }

    const [row] = await db
      .insert(sites)
      .values({
        name,
        description: siteData.description,
        slug,
        public_id,
        owner: siteData.owner!,
        status: siteData.status ?? "active",
        website_url: siteData.website_url,
      })
      .returning();
    return this.toEntity(row);
  }

  async createWithOwner(ownerId: string, siteData: Partial<SiteType>): Promise<SiteType> {
    return withTransaction(async (tx) => {
      const name = siteData.name as string;
      let baseSlug = this.generateSlug(name);
      if (!baseSlug || !/^[a-z0-9-]+$/.test(baseSlug)) {
        baseSlug = "site";
      }
      const slug = await this.ensureUniqueSlug(baseSlug, undefined, tx);
      let public_id = generateSitePublicId();
      for (let i = 0; i < 8; i++) {
        const [taken] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.public_id, public_id)).limit(1);
        if (!taken) break;
        public_id = generateSitePublicId();
      }
      const [site] = await tx
        .insert(sites)
        .values({
          name,
          description: siteData.description,
          slug,
          public_id,
          owner: ownerId,
          status: siteData.status ?? "active",
          website_url: siteData.website_url,
        })
        .returning();
      await tx.insert(siteMembers).values({
        site_id: site.id,
        user_id: ownerId,
        role: SiteMemberRole.OWNER,
        joined_at: new Date(),
      });
      return this.toEntity(site);
    });
  }

  async findOwnerIdsByUserIds(userIds: string[]): Promise<Array<{ _id: string; owner: string }>> {
    if (!userIds.length) return [];
    const rows = await db.select({ id: sites.id, owner: sites.owner }).from(sites).where(inArray(sites.owner, userIds));
    return rows.map((r) => ({ _id: r.id, owner: r.owner }));
  }

  async findById(id: string): Promise<SiteType | null> {
    const [row] = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByPublicId(publicId: string): Promise<SiteType | null> {
    const [row] = await db.select().from(sites).where(eq(sites.public_id, publicId)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<SiteType | null> {
    const [row] = await db.select().from(sites).where(eq(sites.slug, slug)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByOwner(ownerId: string): Promise<SiteType[]> {
    const rows = await db.select().from(sites).where(eq(sites.owner, ownerId)).orderBy(desc(sites.created_at));
    return withIds(rows) as unknown as SiteType[];
  }

  async findByUser(userId: string): Promise<SiteType[]> {
    const memberRows = await db
      .select({ site_id: siteMembers.site_id })
      .from(siteMembers)
      .where(eq(siteMembers.user_id, userId));
    const memberSiteIds = memberRows.map((m) => m.site_id);

    const rows = await db
      .select()
      .from(sites)
      .where(
        memberSiteIds.length > 0
          ? or(eq(sites.owner, userId), inArray(sites.id, memberSiteIds))
          : eq(sites.owner, userId)
      )
      .orderBy(desc(sites.created_at));
    return withIds(rows) as unknown as SiteType[];
  }

  async update(id: string, updateData: Partial<SiteType>): Promise<SiteType | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<SiteType> & { id?: string };
    if (rest.name) {
      const baseSlug = this.generateSlug(rest.name);
      rest.slug = await this.ensureUniqueSlug(baseSlug, id);
    }

    const [row] = await db
      .update(sites)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(sites.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string): Promise<void> {
    await db.delete(sites).where(eq(sites.id, id));
  }

  async isOwner(siteId: string, userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.owner, userId)))
      .limit(1);
    return !!row;
  }

  async getMemberCount(siteId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(siteMembers)
      .where(eq(siteMembers.site_id, siteId));
    return Number(row?.value ?? 0);
  }
}
