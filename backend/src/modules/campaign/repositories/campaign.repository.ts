import { injectable } from "tsyringe";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Campaign as CampaignType } from "../../../shared/schemas/campaign.schema";
import { CampaignStatus, CampaignLifecycleStatus } from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";
import { CampaignQueryFilters } from "../interfaces/campaign.interface";
import { db } from "../../../shared/database";
import { campaigns } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

function lifecycleFromStatus(status?: CampaignStatus | string): CampaignLifecycleStatus {
  switch (status) {
    case CampaignStatus.ACTIVE:
      return CampaignLifecycleStatus.ACTIVE;
    case CampaignStatus.PAUSED:
      return CampaignLifecycleStatus.PAUSED;
    case CampaignStatus.COMPLETED:
      return CampaignLifecycleStatus.COMPLETED;
    case CampaignStatus.CANCELLED:
      return CampaignLifecycleStatus.ARCHIVED;
    default:
      return CampaignLifecycleStatus.DRAFT;
  }
}

@injectable()
export class CampaignRepository {
  private toEntity(row: typeof campaigns.$inferSelect): CampaignType {
    return withId(row) as unknown as CampaignType;
  }

  async create(campaignData: Partial<CampaignType>): Promise<CampaignType> {
    const { _id: _ignored, id: _idIgnored, ...rest } = campaignData as Partial<CampaignType> & { id?: string };
    const status = rest.status ?? CampaignStatus.DRAFT;
    const lifecycle_status = rest.lifecycle_status ?? lifecycleFromStatus(status);
    const [row] = await db
      .insert(campaigns)
      .values({
        user_id: rest.user_id!,
        site_id: rest.site_id!,
        name: rest.name!,
        goal: rest.goal!,
        start_date: rest.start_date!,
        end_date: rest.end_date!,
        posting_frequency: rest.posting_frequency!,
        status,
        lifecycle_status,
        ...omitUndefined({
          description: rest.description,
          target_audience: rest.target_audience,
          campaign_type: rest.campaign_type,
          health_status: rest.health_status,
          health_computed_at: rest.health_computed_at,
          health_reasons: rest.health_reasons,
          is_default: rest.is_default,
          strategy_id: rest.strategy_id,
          messaging: rest.messaging,
          desired_transformation: rest.desired_transformation,
          funnel_focus: rest.funnel_focus,
          guardrails: rest.guardrails,
          assumptions: rest.assumptions,
          hypotheses: rest.hypotheses,
          related_products: rest.related_products,
          supporting_evidence: rest.supporting_evidence,
          intelligence: rest.intelligence,
          content_autonomy: rest.content_autonomy,
          publishing_mode: rest.publishing_mode,
          approval_policy: rest.approval_policy,
          primary_topics: rest.primary_topics,
          cta_strategy: rest.cta_strategy,
          notifications: rest.notifications,
          custom_schedule: rest.custom_schedule,
          timezone: rest.timezone,
          total_posts_planned: rest.total_posts_planned,
          posts_published: rest.posts_published,
          budget: rest.budget,
          success_metrics: rest.success_metrics,
          ai_strategy: rest.ai_strategy,
          template_id: rest.template_id,
        } as Record<string, unknown>),
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string, siteId?: string): Promise<CampaignType | null> {
    const filters = [eq(campaigns.id, id)];
    if (siteId) {
      filters.push(eq(campaigns.site_id, siteId));
    }
    const [row] = await db
      .select()
      .from(campaigns)
      .where(and(...filters))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByUser(userId: string, siteId: string, filters?: CampaignQueryFilters): Promise<CampaignType[]> {
    const conditions = [eq(campaigns.user_id, userId), eq(campaigns.site_id, siteId)];

    if (filters?.status) {
      conditions.push(eq(campaigns.status, filters.status));
    }
    if (filters?.start_date_from) {
      conditions.push(gte(campaigns.start_date, filters.start_date_from));
    }
    if (filters?.start_date_to) {
      conditions.push(lte(campaigns.start_date, filters.start_date_to));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(campaigns.name, `%${filters.search}%`),
          ilike(campaigns.goal, `%${filters.search}%`),
          ilike(campaigns.description, `%${filters.search}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.created_at));
    return withIds(rows) as unknown as CampaignType[];
  }

  async findAll(siteId: string, filters?: CampaignQueryFilters): Promise<PaginatedResponse<CampaignType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(campaigns.site_id, siteId)];

    if (filters?.status) {
      conditions.push(eq(campaigns.status, filters.status));
    }
    if (filters?.start_date_from) {
      conditions.push(gte(campaigns.start_date, filters.start_date_from));
    }
    if (filters?.start_date_to) {
      conditions.push(lte(campaigns.start_date, filters.start_date_to));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(campaigns.name, `%${filters.search}%`),
          ilike(campaigns.goal, `%${filters.search}%`),
          ilike(campaigns.description, `%${filters.search}%`)
        )!
      );
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db.select().from(campaigns).where(where).orderBy(desc(campaigns.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(campaigns)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: withIds(rows) as unknown as CampaignType[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, siteId: string, updateData: Partial<CampaignType>): Promise<CampaignType | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<CampaignType> & { id?: string };
    const [row] = await db
      .update(campaigns)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(and(eq(campaigns.id, id), eq(campaigns.site_id, siteId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const rows = await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.site_id, siteId)))
      .returning({ id: campaigns.id });
    return rows.length > 0;
  }

  /** Active or paused campaigns eligible for daily progress reports. */
  async findForDailyProgress(siteId?: string): Promise<CampaignType[]> {
    const lifecycleOrStatus = or(
      inArray(campaigns.lifecycle_status, [CampaignLifecycleStatus.ACTIVE, CampaignLifecycleStatus.PAUSED]),
      inArray(campaigns.status, [CampaignStatus.ACTIVE, CampaignStatus.PAUSED])
    )!;
    const where = siteId ? and(eq(campaigns.site_id, siteId), lifecycleOrStatus) : lifecycleOrStatus;
    const rows = await db.select().from(campaigns).where(where);
    return withIds(rows) as unknown as CampaignType[];
  }

  async findActiveCampaigns(siteId?: string): Promise<CampaignType[]> {
    const now = new Date();
    const conditions = [
      eq(campaigns.status, CampaignStatus.ACTIVE),
      lte(campaigns.start_date, now),
      gte(campaigns.end_date, now),
    ];
    if (siteId) {
      conditions.push(eq(campaigns.site_id, siteId));
    }
    const rows = await db
      .select()
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(asc(campaigns.start_date));
    return withIds(rows) as unknown as CampaignType[];
  }

  async updatePostsPublished(campaignId: string, increment: number = 1): Promise<void> {
    await db
      .update(campaigns)
      .set({ posts_published: sql`${campaigns.posts_published} + ${increment}`, updated_at: new Date() })
      .where(eq(campaigns.id, campaignId));
  }

  async findByDateRange(siteId: string, startDate: Date, endDate: Date): Promise<CampaignType[]> {
    const rows = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.site_id, siteId), lte(campaigns.start_date, endDate), gte(campaigns.end_date, startDate)))
      .orderBy(asc(campaigns.start_date));
    return withIds(rows) as unknown as CampaignType[];
  }

  async findDefault(siteId: string): Promise<CampaignType | null> {
    const [row] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.site_id, siteId), eq(campaigns.is_default, true)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async assignUnboundStrategy(siteId: string, strategyId: string): Promise<number> {
    const rows = await db
      .update(campaigns)
      .set({ strategy_id: strategyId, updated_at: new Date() })
      .where(and(eq(campaigns.site_id, siteId), isNull(campaigns.strategy_id)))
      .returning({ id: campaigns.id });
    return rows.length;
  }
}
