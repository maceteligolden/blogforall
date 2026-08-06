import { injectable } from "tsyringe";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { CampaignIntelligenceService } from "./campaign-intelligence.service";
import { MemoryRecordRepository } from "../../orchestrator/repositories/memory-record.repository";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { randomUUID } from "crypto";
import type { MemoryRecord } from "../../orchestrator/ai/contracts/memory-record";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";
import Blog from "../../../shared/schemas/blog.schema";

const MAX_CONFIRM_DELTA = 0.08;
const ENGAGEMENT_VIEWS_CONFIRM = 50;
const ENGAGEMENT_VIEWS_STRONG = 200;

/**
 * Closed loop: publish / stats → Content Intelligence → belief confirm/invalidate (doc 21 / T6.1).
 */
@injectable()
export class LearningLoopService {
  constructor(
    private readonly knowledge: BusinessKnowledgeService,
    private readonly intelligence: CampaignIntelligenceService,
    private readonly records: MemoryRecordRepository,
    private readonly campaigns: CampaignRepository
  ) {}

  async onBlogPublished(siteId: string, blogId: string, campaignId?: string): Promise<void> {
    if (!env.orchestrator.strategicIntelligenceEnabled) return;
    try {
      await this.writeContentIntelligence(siteId, blogId, "published", 1, { campaign_id: campaignId });
      // Publishing is weak evidence of audience/goals fit — small capped bump.
      await this.knowledge.confirmBelief(siteId, "business.audience", 0.02);
      await this.knowledge.confirmBelief(siteId, "business.goals", 0.02);
      if (campaignId) {
        await this.touchHypotheses(siteId, campaignId, "publish");
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
      const engagement = views + likes * 5;
      await this.writeContentIntelligence(siteId, blogId, "engagement", engagement, {
        campaign_id: blog.campaign_id,
        views,
        likes,
      });

      if (views >= ENGAGEMENT_VIEWS_STRONG) {
        await this.knowledge.confirmBelief(siteId, "business.audience", Math.min(MAX_CONFIRM_DELTA, 0.05));
        await this.knowledge.confirmBelief(siteId, "business.positioning", 0.03);
        if (blog.campaign_id) {
          await this.touchHypotheses(siteId, blog.campaign_id, "strong_engagement");
        }
      } else if (views >= ENGAGEMENT_VIEWS_CONFIRM) {
        await this.knowledge.confirmBelief(siteId, "business.audience", 0.03);
      }

      // Near-zero engagement after meaningful window: soft signal only (no auto-invalidate of core beliefs).
      if (views === 0 && likes === 0 && blog.status === "published") {
        await this.writeContentIntelligence(siteId, blogId, "engagement_weak", 0, {
          campaign_id: blog.campaign_id,
        });
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

  /**
   * Mark campaign hypotheses as observed (supporting evidence). Does not auto-prove;
   * appends a note into supporting_evidence for strategist review.
   */
  private async touchHypotheses(
    siteId: string,
    campaignId: string,
    signal: "publish" | "strong_engagement"
  ): Promise<void> {
    const campaign = await this.campaigns.findById(campaignId, siteId);
    if (!campaign) return;
    const hypotheses = campaign.hypotheses ?? [];
    if (!hypotheses.length) return;

    const note =
      signal === "strong_engagement"
        ? `Hypothesis check (${new Date().toISOString()}): strong engagement may support messaging assumptions.`
        : `Hypothesis check (${new Date().toISOString()}): content published under this campaign.`;
    const evidence = [...(campaign.supporting_evidence ?? []), note].slice(-20);
    await this.campaigns.update(campaignId, siteId, { supporting_evidence: evidence });
  }

  private async writeContentIntelligence(
    siteId: string,
    blogId: string,
    metric: string,
    value: number,
    extra?: Record<string, unknown>
  ): Promise<void> {
    const now = new Date().toISOString();
    const key = `content_intel.${blogId}.${metric}`;
    const record: MemoryRecord = {
      id: `mr_${randomUUID()}`,
      workspace_id: siteId,
      user_id: null,
      layer: "content_intelligence",
      canonical_key: key,
      value: { blog_id: blogId, metric, value, at: now, ...extra },
      value_text: `${metric}=${value} for blog ${blogId}`,
      metadata: {
        created_at: now,
        updated_at: now,
        confidence: 0.7,
        importance: metric === "engagement" ? Math.min(0.9, 0.4 + value / 500) : 0.5,
        cognitive_kind: "episodic",
        version: 1,
        source: "analytics",
        belief_status: "confirmed",
      },
    };
    await this.records.upsert(record);
  }
}
