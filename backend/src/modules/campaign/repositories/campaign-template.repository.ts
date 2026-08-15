import { injectable } from "tsyringe";
import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { CampaignTemplate as CampaignTemplateType } from "../../../shared/schemas/campaign-template.schema";
import { CampaignTemplateType as TemplateType } from "../../../shared/constants/campaign.constant";
import { CampaignTemplateQueryFilters } from "../interfaces/campaign-template.interface";
import { db } from "../../../shared/database";
import { campaignTemplates } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class CampaignTemplateRepository {
  private toEntity(row: typeof campaignTemplates.$inferSelect): CampaignTemplateType {
    return withId(row) as unknown as CampaignTemplateType;
  }

  async create(templateData: Partial<CampaignTemplateType>): Promise<CampaignTemplateType> {
    const { _id: _ignored, id: _idIgnored, ...rest } = templateData as Partial<CampaignTemplateType> & { id?: string };
    const [row] = await db
      .insert(campaignTemplates)
      .values({
        name: rest.name!,
        description: rest.description!,
        type: rest.type!,
        default_goal: rest.default_goal!,
        default_duration_days: rest.default_duration_days!,
        default_frequency: rest.default_frequency!,
        default_posts_count: rest.default_posts_count!,
        ...omitUndefined({
          suggested_topics: rest.suggested_topics,
          content_themes: rest.content_themes,
          ai_prompts: rest.ai_prompts,
          metadata: rest.metadata,
          is_active: rest.is_active,
        } as Record<string, unknown>),
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string): Promise<CampaignTemplateType | null> {
    const [row] = await db.select().from(campaignTemplates).where(eq(campaignTemplates.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findAll(filters?: CampaignTemplateQueryFilters): Promise<CampaignTemplateType[]> {
    const conditions: SQL[] = [];

    if (filters?.type) {
      conditions.push(eq(campaignTemplates.type, filters.type));
    }
    if (filters?.is_active !== undefined) {
      conditions.push(eq(campaignTemplates.is_active, filters.is_active));
    } else {
      conditions.push(eq(campaignTemplates.is_active, true));
    }
    if (filters?.industry) {
      conditions.push(
        sql`(${campaignTemplates.metadata}->'industries') @> ${JSON.stringify([filters.industry])}::jsonb`
      );
    }

    const rows = await db
      .select()
      .from(campaignTemplates)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(campaignTemplates.name));
    return withIds(rows) as unknown as CampaignTemplateType[];
  }

  async findByType(type: TemplateType): Promise<CampaignTemplateType[]> {
    const rows = await db
      .select()
      .from(campaignTemplates)
      .where(and(eq(campaignTemplates.type, type), eq(campaignTemplates.is_active, true)))
      .orderBy(asc(campaignTemplates.name));
    return withIds(rows) as unknown as CampaignTemplateType[];
  }

  async update(id: string, updateData: Partial<CampaignTemplateType>): Promise<CampaignTemplateType | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<CampaignTemplateType> & { id?: string };
    const [row] = await db
      .update(campaignTemplates)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(campaignTemplates.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db
      .delete(campaignTemplates)
      .where(eq(campaignTemplates.id, id))
      .returning({ id: campaignTemplates.id });
    return rows.length > 0;
  }
}
