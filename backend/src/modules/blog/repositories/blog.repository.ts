import { injectable } from "tsyringe";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { Blog as BlogType } from "../../../shared/schemas/blog.schema";
import { BlogStatus } from "../../../shared/constants";
import { PaginatedResponse } from "../../../shared/interfaces";
import { db } from "../../../shared/database";
import { blogs, blogLikes, blogVersions } from "../../../shared/database/schema";
import { omitUndefined, withId } from "../../../shared/database/map-row";

type BlogRow = typeof blogs.$inferSelect;
type VersionRow = typeof blogVersions.$inferSelect;

@injectable()
export class BlogRepository {
  private toVersion(row: VersionRow): NonNullable<BlogType["version_history"]>[number] {
    return {
      version: row.version,
      content: row.content,
      title: row.title,
      excerpt: row.excerpt ?? undefined,
      created_at: row.created_at,
      review_id: row.review_id ?? undefined,
    };
  }

  private toEntity(row: BlogRow, likedBy: string[] = [], versions: VersionRow[] = []): BlogType {
    return {
      ...withId(row),
      liked_by: likedBy,
      version_history: versions.map((v) => this.toVersion(v)),
    } as unknown as BlogType;
  }

  private async hydrateOne(row: BlogRow): Promise<BlogType> {
    const [likes, versions] = await Promise.all([
      db.select().from(blogLikes).where(eq(blogLikes.blog_id, row.id)),
      db.select().from(blogVersions).where(eq(blogVersions.blog_id, row.id)).orderBy(blogVersions.version),
    ]);
    return this.toEntity(
      row,
      likes.map((l) => l.actor),
      versions
    );
  }

  private async hydrateMany(rows: BlogRow[]): Promise<BlogType[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [likes, versions] = await Promise.all([
      db.select().from(blogLikes).where(inArray(blogLikes.blog_id, ids)),
      db.select().from(blogVersions).where(inArray(blogVersions.blog_id, ids)).orderBy(blogVersions.version),
    ]);
    const likesByBlog = new Map<string, string[]>();
    for (const like of likes) {
      const list = likesByBlog.get(like.blog_id) ?? [];
      list.push(like.actor);
      likesByBlog.set(like.blog_id, list);
    }
    const versionsByBlog = new Map<string, VersionRow[]>();
    for (const version of versions) {
      const list = versionsByBlog.get(version.blog_id) ?? [];
      list.push(version);
      versionsByBlog.set(version.blog_id, list);
    }
    return rows.map((row) => this.toEntity(row, likesByBlog.get(row.id) ?? [], versionsByBlog.get(row.id) ?? []));
  }

  private async syncLikes(blogId: string, likedBy: string[]): Promise<void> {
    await db.delete(blogLikes).where(eq(blogLikes.blog_id, blogId));
    if (!likedBy.length) return;
    await db.insert(blogLikes).values(likedBy.map((actor) => ({ blog_id: blogId, actor })));
  }

  private async syncVersions(blogId: string, history: NonNullable<BlogType["version_history"]>): Promise<void> {
    await db.delete(blogVersions).where(eq(blogVersions.blog_id, blogId));
    if (!history.length) return;
    await db.insert(blogVersions).values(
      history.map((v) => ({
        blog_id: blogId,
        version: v.version,
        content: v.content,
        title: v.title,
        excerpt: v.excerpt,
        review_id: v.review_id,
        created_at: v.created_at ?? new Date(),
      }))
    );
  }

  async create(blogData: Partial<BlogType>): Promise<BlogType> {
    const {
      _id: _ignored,
      id: _idIgnored,
      liked_by,
      version_history,
      ...rest
    } = blogData as Partial<BlogType> & {
      id?: string;
    };
    const [row] = await db
      .insert(blogs)
      .values({
        author: rest.author!,
        site_id: rest.site_id!,
        title: rest.title!,
        content: rest.content!,
        slug: rest.slug!,
        ...omitUndefined({
          campaign_id: rest.campaign_id,
          strategy_id: rest.strategy_id,
          content_type: rest.content_type,
          content_blocks: rest.content_blocks,
          excerpt: rest.excerpt,
          featured_image: rest.featured_image,
          images: rest.images,
          status: rest.status,
          category: rest.category,
          likes: rest.likes,
          views: rest.views,
          published_at: rest.published_at,
          dynamic_forms: rest.dynamic_forms,
          meta: rest.meta,
        } as Record<string, unknown>),
      })
      .returning();
    if (liked_by?.length) {
      await this.syncLikes(row.id, liked_by);
    }
    if (version_history?.length) {
      await this.syncVersions(row.id, version_history);
    }
    return this.hydrateOne(row);
  }

  async findById(id: string, siteId?: string): Promise<BlogType | null> {
    const filters = [eq(blogs.id, id)];
    if (siteId) {
      filters.push(eq(blogs.site_id, siteId));
    }
    const [row] = await db
      .select()
      .from(blogs)
      .where(and(...filters))
      .limit(1);
    return row ? this.hydrateOne(row) : null;
  }

  async findBySlug(slug: string, siteId: string): Promise<BlogType | null> {
    const [row] = await db
      .select()
      .from(blogs)
      .where(and(eq(blogs.slug, slug), eq(blogs.site_id, siteId)))
      .limit(1);
    return row ? this.hydrateOne(row) : null;
  }

  async findByAuthor(authorId: string, siteId: string, filters?: { status?: BlogStatus }): Promise<BlogType[]> {
    const conditions = [eq(blogs.author, authorId), eq(blogs.site_id, siteId)];
    if (filters?.status) {
      conditions.push(eq(blogs.status, filters.status));
    }
    const rows = await db
      .select()
      .from(blogs)
      .where(and(...conditions))
      .orderBy(desc(blogs.created_at));
    return this.hydrateMany(rows);
  }

  async findByAuthorAcrossSites(
    authorId: string,
    input?: { page?: number; limit?: number; search?: string }
  ): Promise<PaginatedResponse<BlogType>> {
    const page = input?.page || 1;
    const limit = input?.limit || 10;
    const offset = (page - 1) * limit;
    const conditions = [eq(blogs.author, authorId)];

    if (input?.search) {
      conditions.push(or(ilike(blogs.title, `%${input.search}%`), ilike(blogs.excerpt, `%${input.search}%`))!);
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db.select().from(blogs).where(where).orderBy(desc(blogs.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(blogs)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: await this.hydrateMany(rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async countByAuthors(authorIds: string[]): Promise<Record<string, number>> {
    if (!authorIds.length) return {};
    const rows = await db
      .select({ author: blogs.author, count: sql<number>`count(*)` })
      .from(blogs)
      .where(inArray(blogs.author, authorIds))
      .groupBy(blogs.author);
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.author] = Number(row.count);
      return acc;
    }, {});
  }

  async findAll(
    siteId: string,
    filters?: {
      status?: BlogStatus;
      search?: string;
      category?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<BlogType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(blogs.site_id, siteId)];
    if (filters?.status) {
      conditions.push(eq(blogs.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(blogs.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(blogs.title, `%${filters.search}%`),
          ilike(blogs.excerpt, `%${filters.search}%`),
          ilike(blogs.content, `%${filters.search}%`)
        )!
      );
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db.select().from(blogs).where(where).orderBy(desc(blogs.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(blogs)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: await this.hydrateMany(rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllAcrossSites(input: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<PaginatedResponse<BlogType>> {
    const { page, limit, search } = input;
    const offset = (page - 1) * limit;
    const conditions = search
      ? [or(ilike(blogs.title, `%${search}%`), ilike(blogs.excerpt, `%${search}%`), ilike(blogs.slug, `%${search}%`))!]
      : [];

    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRows] = await Promise.all([
      db.select().from(blogs).where(where).orderBy(desc(blogs.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(blogs)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: await this.hydrateMany(rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findPublished(
    siteId: string,
    filters?: {
      search?: string;
      category?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<BlogType>> {
    return this.findAll(siteId, {
      ...filters,
      status: BlogStatus.PUBLISHED,
    });
  }

  async update(id: string, siteId: string, updateData: Partial<BlogType>): Promise<BlogType | null> {
    const {
      _id: _ignored,
      id: _idIgnored,
      liked_by,
      version_history,
      ...rest
    } = updateData as Partial<BlogType> & {
      id?: string;
    };
    const [row] = await db
      .update(blogs)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(and(eq(blogs.id, id), eq(blogs.site_id, siteId)))
      .returning();
    if (!row) return null;
    if (liked_by) {
      await this.syncLikes(id, liked_by);
    }
    if (version_history) {
      await this.syncVersions(id, version_history);
    }
    return this.hydrateOne(row);
  }

  async delete(id: string, siteId: string): Promise<void> {
    await db.delete(blogs).where(and(eq(blogs.id, id), eq(blogs.site_id, siteId)));
  }

  async incrementViews(id: string, siteId: string): Promise<void> {
    await db
      .update(blogs)
      .set({ views: sql`${blogs.views} + 1`, updated_at: new Date() })
      .where(and(eq(blogs.id, id), eq(blogs.site_id, siteId)));
  }

  async toggleLike(id: string, siteId: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    return db.transaction(async (tx) => {
      const [blog] = await tx
        .select()
        .from(blogs)
        .where(and(eq(blogs.id, id), eq(blogs.site_id, siteId)))
        .limit(1);
      if (!blog) {
        throw new Error("Blog not found");
      }

      const [existing] = await tx
        .select()
        .from(blogLikes)
        .where(and(eq(blogLikes.blog_id, id), eq(blogLikes.actor, userIdOrIp)))
        .limit(1);

      if (existing) {
        await tx.delete(blogLikes).where(eq(blogLikes.id, existing.id));
        const [updated] = await tx
          .update(blogs)
          .set({ likes: sql`GREATEST(${blogs.likes} - 1, 0)`, updated_at: new Date() })
          .where(eq(blogs.id, id))
          .returning({ likes: blogs.likes });
        return { likes: updated.likes, isLiked: false };
      }

      await tx.insert(blogLikes).values({ blog_id: id, actor: userIdOrIp });
      const [updated] = await tx
        .update(blogs)
        .set({ likes: sql`${blogs.likes} + 1`, updated_at: new Date() })
        .where(eq(blogs.id, id))
        .returning({ likes: blogs.likes });
      return { likes: updated.likes, isLiked: true };
    });
  }

  async incrementCommentCount(_id: string): Promise<void> {
    // Comment count is tracked via Comment collection queries
    // This method is kept for consistency but doesn't modify blog document
  }

  async decrementCommentCount(_id: string): Promise<void> {
    // Comment count is tracked via Comment collection queries
    // This method is kept for consistency but doesn't modify blog document
  }

  async countPublishedBySite(siteId: string): Promise<number> {
    return this.countBySiteAndStatus(siteId, BlogStatus.PUBLISHED);
  }

  async countBySiteAndStatus(siteId: string, status: BlogStatus): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(blogs)
      .where(and(eq(blogs.site_id, siteId), eq(blogs.status, status)));
    return Number(row?.value ?? 0);
  }

  async countBySiteAndAuthor(siteId: string, authorId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(blogs)
      .where(and(eq(blogs.site_id, siteId), eq(blogs.author, authorId)));
    return Number(row?.value ?? 0);
  }

  async countAll(): Promise<number> {
    const [row] = await db.select({ value: sql<number>`count(*)` }).from(blogs);
    return Number(row?.value ?? 0);
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await db.delete(blogs).where(eq(blogs.site_id, siteId));
  }

  async assignUnboundCampaign(siteId: string, campaignId: string): Promise<number> {
    const rows = await db
      .update(blogs)
      .set({ campaign_id: campaignId, updated_at: new Date() })
      .where(and(eq(blogs.site_id, siteId), isNull(blogs.campaign_id)))
      .returning({ id: blogs.id });
    return rows.length;
  }
}
