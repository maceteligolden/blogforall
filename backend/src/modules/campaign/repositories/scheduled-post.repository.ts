import { injectable } from "tsyringe";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { ScheduledPost as ScheduledPostType } from "../../../shared/schemas/scheduled-post.schema";
import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";
import { ScheduledPostQueryFilters } from "../interfaces/scheduled-post.interface";
import { db } from "../../../shared/database";
import { scheduledPosts } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class ScheduledPostRepository {
  private toEntity(row: typeof scheduledPosts.$inferSelect): ScheduledPostType {
    return withId(row) as unknown as ScheduledPostType;
  }

  private toInsertValues(postData: Partial<ScheduledPostType>) {
    const { _id: _ignored, id: _idIgnored, ...rest } = postData as Partial<ScheduledPostType> & { id?: string };
    return {
      user_id: rest.user_id!,
      site_id: rest.site_id!,
      title: rest.title!,
      scheduled_at: rest.scheduled_at!,
      ...omitUndefined({
        blog_id: rest.blog_id,
        campaign_id: rest.campaign_id,
        timezone: rest.timezone,
        status: rest.status,
        publish_attempts: rest.publish_attempts,
        last_attempt_at: rest.last_attempt_at,
        error_message: rest.error_message,
        published_at: rest.published_at,
        auto_generate: rest.auto_generate,
        generation_prompt: rest.generation_prompt,
        metadata: rest.metadata,
        prepared_at: rest.prepared_at,
        approved_at: rest.approved_at,
        approved_by_user_id: rest.approved_by_user_id,
        rework_comments: rest.rework_comments,
        rework_round: rest.rework_round,
      } as Record<string, unknown>),
    };
  }

  async create(postData: Partial<ScheduledPostType>): Promise<ScheduledPostType> {
    const [row] = await db.insert(scheduledPosts).values(this.toInsertValues(postData)).returning();
    return this.toEntity(row);
  }

  async createMany(posts: Partial<ScheduledPostType>[]): Promise<ScheduledPostType[]> {
    if (!posts.length) return [];
    const rows = await db
      .insert(scheduledPosts)
      .values(posts.map((post) => this.toInsertValues(post)))
      .returning();
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  async findById(id: string, siteId?: string): Promise<ScheduledPostType | null> {
    const filters = [eq(scheduledPosts.id, id)];
    if (siteId) {
      filters.push(eq(scheduledPosts.site_id, siteId));
    }
    const [row] = await db
      .select()
      .from(scheduledPosts)
      .where(and(...filters))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByBlog(blogId: string): Promise<ScheduledPostType[]> {
    const rows = await db.select().from(scheduledPosts).where(eq(scheduledPosts.blog_id, blogId));
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  async findByCampaign(campaignId: string, siteId?: string): Promise<ScheduledPostType[]> {
    const conditions = [eq(scheduledPosts.campaign_id, campaignId)];
    if (siteId) {
      conditions.push(eq(scheduledPosts.site_id, siteId));
    }
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(and(...conditions))
      .orderBy(asc(scheduledPosts.scheduled_at));
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  async findByUser(userId: string, siteId: string, filters?: ScheduledPostQueryFilters): Promise<ScheduledPostType[]> {
    const conditions = [eq(scheduledPosts.user_id, userId), eq(scheduledPosts.site_id, siteId)];

    if (filters?.campaign_id) {
      conditions.push(eq(scheduledPosts.campaign_id, filters.campaign_id));
    }
    if (filters?.status) {
      conditions.push(eq(scheduledPosts.status, filters.status));
    }
    if (filters?.scheduled_at_from) {
      conditions.push(gte(scheduledPosts.scheduled_at, filters.scheduled_at_from));
    }
    if (filters?.scheduled_at_to) {
      conditions.push(lte(scheduledPosts.scheduled_at, filters.scheduled_at_to));
    }

    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(and(...conditions))
      .orderBy(asc(scheduledPosts.scheduled_at));
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  async findAll(siteId: string, filters?: ScheduledPostQueryFilters): Promise<PaginatedResponse<ScheduledPostType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(scheduledPosts.site_id, siteId)];

    if (filters?.campaign_id) {
      conditions.push(eq(scheduledPosts.campaign_id, filters.campaign_id));
    }
    if (filters?.status) {
      conditions.push(eq(scheduledPosts.status, filters.status));
    }
    if (filters?.scheduled_at_from) {
      conditions.push(gte(scheduledPosts.scheduled_at, filters.scheduled_at_from));
    }
    if (filters?.scheduled_at_to) {
      conditions.push(lte(scheduledPosts.scheduled_at, filters.scheduled_at_to));
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(scheduledPosts)
        .where(where)
        .orderBy(asc(scheduledPosts.scheduled_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(scheduledPosts)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: withIds(rows) as unknown as ScheduledPostType[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, siteId: string, updateData: Partial<ScheduledPostType>): Promise<ScheduledPostType | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<ScheduledPostType> & { id?: string };
    const [row] = await db
      .update(scheduledPosts)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.site_id, siteId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const rows = await db
      .delete(scheduledPosts)
      .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.site_id, siteId)))
      .returning({ id: scheduledPosts.id });
    return rows.length > 0;
  }

  async findPendingPosts(limit: number = 100): Promise<ScheduledPostType[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          inArray(scheduledPosts.status, [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED]),
          lte(scheduledPosts.scheduled_at, now)
        )
      )
      .orderBy(asc(scheduledPosts.scheduled_at))
      .limit(limit);
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  /**
   * Posts that are eligible for the pre-publish "prepare" phase: they are
   * still PENDING/SCHEDULED, do not have a `prepared_at` timestamp yet, and
   * are within `leadTimeMs` of their scheduled publish time. The prepare
   * worker will (re)generate content if needed, transition them to
   * AWAITING_APPROVAL, and mint a review token.
   */
  async findDueForPreparation(leadTimeMs: number, limit: number = 50): Promise<ScheduledPostType[]> {
    const horizon = new Date(Date.now() + leadTimeMs);
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          inArray(scheduledPosts.status, [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED]),
          lte(scheduledPosts.scheduled_at, horizon),
          isNull(scheduledPosts.prepared_at)
        )
      )
      .orderBy(asc(scheduledPosts.scheduled_at))
      .limit(limit);
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  /**
   * Posts that have human approval and have reached their publish time.
   * Used by the publish worker; AWAITING_APPROVAL posts without
   * `approved_at` are intentionally excluded so unreviewed drafts never
   * auto-publish even after their scheduled time elapses.
   */
  async findReadyForPublication(limit: number = 100): Promise<ScheduledPostType[]> {
    const now = new Date();
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, ScheduledPostStatus.AWAITING_APPROVAL),
          isNotNull(scheduledPosts.approved_at),
          lte(scheduledPosts.scheduled_at, now)
        )
      )
      .orderBy(asc(scheduledPosts.scheduled_at))
      .limit(limit);
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  /**
   * Posts currently AWAITING_APPROVAL with NO approval yet, scheduled to
   * publish between `from` and `to`. Used by the weekly digest cron to roll
   * up "what needs your sign-off this week" across all workspaces.
   */
  async findPendingApprovalsInWindow(from: Date, to: Date, limit: number = 500): Promise<ScheduledPostType[]> {
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, ScheduledPostStatus.AWAITING_APPROVAL),
          isNull(scheduledPosts.approved_at),
          gte(scheduledPosts.scheduled_at, from),
          lte(scheduledPosts.scheduled_at, to)
        )
      )
      .orderBy(asc(scheduledPosts.user_id), asc(scheduledPosts.site_id), asc(scheduledPosts.scheduled_at))
      .limit(limit);
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  /**
   * Atomically transition a scheduled post into the AWAITING_APPROVAL state
   * once the prepare worker has produced a draft. Returns the updated row,
   * or null if a concurrent worker already prepared it.
   */
  async markPrepared(id: string, siteId: string, update: { blog_id?: string }): Promise<ScheduledPostType | null> {
    const [row] = await db
      .update(scheduledPosts)
      .set({
        ...omitUndefined(update as Record<string, unknown>),
        status: ScheduledPostStatus.AWAITING_APPROVAL,
        prepared_at: new Date(),
        updated_at: new Date(),
        error_message: null,
      })
      .where(
        and(
          eq(scheduledPosts.id, id),
          eq(scheduledPosts.site_id, siteId),
          inArray(scheduledPosts.status, [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED])
        )
      )
      .returning();
    return row ? this.toEntity(row) : null;
  }

  /**
   * Atomically record the reviewer's approval. Returns null if the post is
   * not currently AWAITING_APPROVAL (e.g. already approved on another tab).
   */
  async markApproved(id: string, siteId: string, approverUserId: string): Promise<ScheduledPostType | null> {
    const [row] = await db
      .update(scheduledPosts)
      .set({
        approved_at: new Date(),
        approved_by_user_id: approverUserId,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(scheduledPosts.id, id),
          eq(scheduledPosts.site_id, siteId),
          eq(scheduledPosts.status, ScheduledPostStatus.AWAITING_APPROVAL)
        )
      )
      .returning();
    return row ? this.toEntity(row) : null;
  }

  /**
   * Transition a post into the rework loop. Increments `rework_round` so the
   * next prepare pass can mint a fresh review token tied to the new round
   * and so existing tokens (matched against rework_round) are unambiguously
   * stale.
   */
  async markReworkRequested(
    id: string,
    siteId: string,
    comments: string,
    requesterUserId: string
  ): Promise<ScheduledPostType | null> {
    const [row] = await db
      .update(scheduledPosts)
      .set({
        status: ScheduledPostStatus.REWORK_REQUESTED,
        rework_comments: comments,
        approved_at: null,
        approved_by_user_id: requesterUserId,
        prepared_at: null,
        updated_at: new Date(),
        rework_round: sql`${scheduledPosts.rework_round} + 1`,
      })
      .where(
        and(
          eq(scheduledPosts.id, id),
          eq(scheduledPosts.site_id, siteId),
          eq(scheduledPosts.status, ScheduledPostStatus.AWAITING_APPROVAL)
        )
      )
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async findByDateRange(siteId: string, startDate: Date, endDate: Date): Promise<ScheduledPostType[]> {
    const rows = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.site_id, siteId),
          gte(scheduledPosts.scheduled_at, startDate),
          lte(scheduledPosts.scheduled_at, endDate)
        )
      )
      .orderBy(asc(scheduledPosts.scheduled_at));
    return withIds(rows) as unknown as ScheduledPostType[];
  }

  async markAsPublished(id: string, publishedAt: Date): Promise<void> {
    await db
      .update(scheduledPosts)
      .set({
        status: ScheduledPostStatus.PUBLISHED,
        published_at: publishedAt,
        updated_at: new Date(),
      })
      .where(eq(scheduledPosts.id, id));
  }

  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await db
      .update(scheduledPosts)
      .set({
        status: ScheduledPostStatus.FAILED,
        error_message: errorMessage,
        last_attempt_at: new Date(),
        publish_attempts: sql`${scheduledPosts.publish_attempts} + 1`,
        updated_at: new Date(),
      })
      .where(eq(scheduledPosts.id, id));
  }

  async incrementAttempts(id: string): Promise<void> {
    await db
      .update(scheduledPosts)
      .set({
        last_attempt_at: new Date(),
        publish_attempts: sql`${scheduledPosts.publish_attempts} + 1`,
        updated_at: new Date(),
      })
      .where(eq(scheduledPosts.id, id));
  }

  async countByCampaign(campaignId: string, status?: ScheduledPostStatus): Promise<number> {
    const conditions = [eq(scheduledPosts.campaign_id, campaignId)];
    if (status) {
      conditions.push(eq(scheduledPosts.status, status));
    }
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(scheduledPosts)
      .where(and(...conditions));
    return Number(row?.value ?? 0);
  }

  async isBlogScheduled(blogId: string): Promise<boolean> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.blog_id, blogId),
          inArray(scheduledPosts.status, [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED])
        )
      );
    return Number(row?.value ?? 0) > 0;
  }

  async assignUnboundCampaign(siteId: string, campaignId: string): Promise<number> {
    const rows = await db
      .update(scheduledPosts)
      .set({ campaign_id: campaignId, updated_at: new Date() })
      .where(and(eq(scheduledPosts.site_id, siteId), isNull(scheduledPosts.campaign_id)))
      .returning({ id: scheduledPosts.id });
    return rows.length;
  }
}
