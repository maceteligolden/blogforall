import { injectable } from "tsyringe";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { CampaignIntelligenceService } from "./campaign-intelligence.service";
import { MemoryRecordRepository } from "../../orchestrator/repositories/memory-record.repository";
import { randomUUID } from "crypto";
import type { MemoryRecord } from "../../orchestrator/ai/contracts/memory-record";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";
import Blog from "../../../shared/schemas/blog.schema";

/**
 * Closed loop: publish / stats → Content Intelligence beliefs → confidence bumps (doc 21 §7).
 */
@injectable()
export class LearningLoopService {
  constructor(
    private readonly knowledge: BusinessKnowledgeService,
    private readonly intelligence: CampaignIntelligenceService,
    private readonly records: MemoryRecordRepository
  ) {}

  async onBlogPublished(siteId: string, blogId: string, campaignId?: string): Promise<void> {
    if (!env.orchestrator.strategicIntelligenceEnabled) return;
    try {
      await this.writeContentIntelligence(siteId, blogId, "published", 1);
      await this.knowledge.confirmBelief(siteId, "business.audience", 0.02);
      await this.knowledge.confirmBelief(siteId, "business.goals", 0.02);
      if (campaignId) {
        await this.intelligence.recompute(campaignId, siteId);
      }
    } catch (err) {
      logger.warn(
        "Learning loop on publish failed",
        { siteId, blogId, error: err instanceof Error ? err.message : String(err) },
        "LearningLoopService"
      );
    }
  }

  async onBlogStatsUpdated(siteId: string, blogId: string): Promise<void> {
    if (!env.orchestrator.strategicIntelligenceEnabled) return;
    try {
      const blog = await Blog.findOne({ _id: blogId, site_id: siteId }).lean();
      if (!blog) return;
      const views = blog.views ?? 0;
      const likes = blog.likes ?? 0;
      await this.writeContentIntelligence(siteId, blogId, "engagement", views + likes * 5);
      if (views > 50) {
        await this.knowledge.confirmBelief(siteId, "business.audience", 0.03);
      }
      if (blog.campaign_id) {
        await this.intelligence.recompute(blog.campaign_id, siteId);
      }
    } catch (err) {
      logger.warn(
        "Learning loop on stats failed",
        { siteId, blogId, error: err instanceof Error ? err.message : String(err) },
        "LearningLoopService"
      );
    }
  }

  private async writeContentIntelligence(
    siteId: string,
    blogId: string,
    metric: string,
    value: number
  ): Promise<void> {
    const now = new Date().toISOString();
    const key = `content_intel.${blogId}.${metric}`;
    const record: MemoryRecord = {
      id: `mr_${randomUUID()}`,
      workspace_id: siteId,
      user_id: null,
      layer: "content_intelligence",
      canonical_key: key,
      value: { blog_id: blogId, metric, value, at: now },
      value_text: `${metric}=${value} for blog ${blogId}`,
      metadata: {
        created_at: now,
        updated_at: now,
        confidence: 0.7,
        importance: 0.5,
        cognitive_kind: "episodic",
        version: 1,
      },
    };
    await this.records.upsert(record);
  }
}
