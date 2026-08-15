import { injectable } from "tsyringe";
import { and, asc, eq } from "drizzle-orm";
import { CampaignPostItem } from "../../../shared/schemas/campaign-post-item.schema";
import { db } from "../../../shared/database";
import { campaignPostItems } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class CampaignPostItemRepository {
  private toEntity(row: typeof campaignPostItems.$inferSelect): CampaignPostItem {
    return withId(row) as unknown as CampaignPostItem;
  }

  private toInsertValues(data: Partial<CampaignPostItem>) {
    const { _id: _ignored, id: _idIgnored, ...rest } = data as Partial<CampaignPostItem> & { id?: string };
    return {
      campaign_id: rest.campaign_id!,
      site_id: rest.site_id!,
      title: rest.title!,
      objective: rest.objective!,
      strategic_intent: rest.strategic_intent!,
      ...omitUndefined({
        sequence_index: rest.sequence_index,
        target_keywords: rest.target_keywords,
        content_angle: rest.content_angle,
        narrative_phase: rest.narrative_phase,
        status: rest.status,
        scheduled_at: rest.scheduled_at,
        timezone: rest.timezone,
        blog_id: rest.blog_id,
        scheduled_post_id: rest.scheduled_post_id,
        generated_by: rest.generated_by,
        manually_added: rest.manually_added,
        locked: rest.locked,
        dependencies: rest.dependencies,
      } as Record<string, unknown>),
    };
  }

  async create(data: Partial<CampaignPostItem>): Promise<CampaignPostItem> {
    const [row] = await db.insert(campaignPostItems).values(this.toInsertValues(data)).returning();
    return this.toEntity(row);
  }

  async createMany(items: Partial<CampaignPostItem>[]): Promise<CampaignPostItem[]> {
    if (!items.length) return [];
    const rows = await db
      .insert(campaignPostItems)
      .values(items.map((item) => this.toInsertValues(item)))
      .returning();
    return withIds(rows) as unknown as CampaignPostItem[];
  }

  async findByCampaign(campaignId: string, siteId: string): Promise<CampaignPostItem[]> {
    const rows = await db
      .select()
      .from(campaignPostItems)
      .where(and(eq(campaignPostItems.campaign_id, campaignId), eq(campaignPostItems.site_id, siteId)))
      .orderBy(asc(campaignPostItems.sequence_index));
    return withIds(rows) as unknown as CampaignPostItem[];
  }

  async findById(id: string, siteId: string): Promise<CampaignPostItem | null> {
    const [row] = await db
      .select()
      .from(campaignPostItems)
      .where(and(eq(campaignPostItems.id, id), eq(campaignPostItems.site_id, siteId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByBlogId(blogId: string, siteId: string): Promise<CampaignPostItem[]> {
    const rows = await db
      .select()
      .from(campaignPostItems)
      .where(and(eq(campaignPostItems.blog_id, blogId), eq(campaignPostItems.site_id, siteId)));
    return withIds(rows) as unknown as CampaignPostItem[];
  }

  async update(id: string, siteId: string, data: Partial<CampaignPostItem>): Promise<CampaignPostItem | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = data as Partial<CampaignPostItem> & { id?: string };
    const [row] = await db
      .update(campaignPostItems)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(and(eq(campaignPostItems.id, id), eq(campaignPostItems.site_id, siteId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const rows = await db
      .delete(campaignPostItems)
      .where(and(eq(campaignPostItems.id, id), eq(campaignPostItems.site_id, siteId)))
      .returning({ id: campaignPostItems.id });
    return rows.length > 0;
  }

  async deleteByCampaign(campaignId: string, siteId: string): Promise<void> {
    await db
      .delete(campaignPostItems)
      .where(and(eq(campaignPostItems.campaign_id, campaignId), eq(campaignPostItems.site_id, siteId)));
  }
}
