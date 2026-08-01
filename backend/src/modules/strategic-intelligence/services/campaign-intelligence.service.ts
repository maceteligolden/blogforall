import { injectable } from "tsyringe";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { CampaignPostItemRepository } from "../../campaign/repositories/campaign-post-item.repository";
import { CampaignMemoryRepository } from "../../campaign/repositories/campaign-memory.repository";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { NotFoundError } from "../../../shared/errors";
import type { CampaignIntelligenceSnapshot } from "../../../shared/schemas/campaign.schema";
import { CampaignPostItemStatus } from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignIntelligenceService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly postItemRepository: CampaignPostItemRepository,
    private readonly memoryRepository: CampaignMemoryRepository,
    private readonly knowledge: BusinessKnowledgeService
  ) {}

  async get(campaignId: string, siteId: string): Promise<CampaignIntelligenceSnapshot> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) throw new NotFoundError("Campaign not found");
    if (campaign.intelligence?.computed_at) return campaign.intelligence;
    return this.recompute(campaignId, siteId);
  }

  async recompute(campaignId: string, siteId: string): Promise<CampaignIntelligenceSnapshot> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) throw new NotFoundError("Campaign not found");

    await this.memoryRepository.ensureForCampaign(campaignId, siteId);
    const items = await this.postItemRepository.findByCampaign(campaignId, siteId);
    const gaps = await this.knowledge.listGaps(siteId);
    const topGaps = gaps.slice(0, 8);

    const phases = { awareness: 0, consideration: 0, conversion: 0 };
    for (const item of items) {
      const phase = (item.narrative_phase || "awareness").toLowerCase();
      if (phase.includes("consider")) phases.consideration++;
      else if (phase.includes("convert")) phases.conversion++;
      else phases.awareness++;
    }
    const total = Math.max(1, items.length);
    const funnel_coverage = {
      awareness: phases.awareness / total,
      consideration: phases.consideration / total,
      conversion: phases.conversion / total,
    };

    const published = items.filter((i) => i.status === CampaignPostItemStatus.PUBLISHED).length;
    const planned = items.length || campaign.total_posts_planned || 0;
    const progress_pct = planned > 0 ? Math.round((published / planned) * 100) : 0;

    const assumptions = campaign.assumptions ?? [];
    const hasMessaging = Boolean(campaign.messaging?.trim() || campaign.goal?.trim());
    const hasAudience = Boolean(campaign.target_audience?.trim());
    const knowledge_completeness = Math.max(0, 1 - topGaps.length / 12);
    const audience_understanding = hasAudience ? 0.7 : Math.max(0.2, 1 - (gaps.find((g) => g.key === "business.audience")?.strategic_value ?? 0.8));
    const messaging_confidence = hasMessaging ? 0.65 : 0.3;
    const funnel_score =
      (funnel_coverage.awareness > 0 ? 0.33 : 0) +
      (funnel_coverage.consideration > 0 ? 0.33 : 0) +
      (funnel_coverage.conversion > 0 ? 0.34 : 0);
    const topics = new Set(items.map((i) => i.title.toLowerCase().slice(0, 40)));
    const content_diversity = Math.min(1, topics.size / Math.max(3, planned || 3));
    const conversion_readiness =
      funnel_coverage.conversion > 0 && Boolean(campaign.cta_strategy?.primary_cta) ? 0.7 : 0.35;

    const overall_confidence =
      (knowledge_completeness +
        audience_understanding +
        messaging_confidence +
        funnel_score +
        content_diversity +
        conversion_readiness) /
      6;

    const recommended_actions: string[] = [];
    if (topGaps[0]) recommended_actions.push(`Gather knowledge: ${topGaps[0].question}`);
    if (funnel_coverage.awareness < 0.2) recommended_actions.push("Publish an awareness article for this campaign");
    if (funnel_coverage.conversion < 0.15) recommended_actions.push("Improve conversion messaging or add a CTA-focused post");
    if (!campaign.hypotheses?.length) recommended_actions.push("Document a testable campaign hypothesis");
    if (progress_pct < 30 && planned > 0) recommended_actions.push("Advance the next planned post toward publish");
    if (!recommended_actions.length) recommended_actions.push("Review campaign health and continue the content cadence");

    const snapshot: CampaignIntelligenceSnapshot = {
      knowledge_gaps: topGaps.map((g) => g.key),
      funnel_coverage,
      unverified_assumptions: assumptions,
      next_questions: topGaps.slice(0, 3).map((g) => g.question),
      progress_pct,
      success_probability: Math.round(overall_confidence * 100) / 100,
      recommended_actions,
      dimensions: {
        knowledge_completeness: round(knowledge_completeness),
        audience_understanding: round(audience_understanding),
        messaging_confidence: round(messaging_confidence),
        funnel_coverage: round(funnel_score),
        content_diversity: round(content_diversity),
        conversion_readiness: round(conversion_readiness),
        overall_confidence: round(overall_confidence),
      },
      computed_at: new Date(),
    };

    await this.campaignRepository.update(campaignId, siteId, { intelligence: snapshot });
    return snapshot;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
