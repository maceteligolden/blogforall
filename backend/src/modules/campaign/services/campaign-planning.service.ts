import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../repositories/campaign-roadmap.repository";
import { CampaignMemoryRepository } from "../repositories/campaign-memory.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { OrchestratorApprovalRepository } from "../../orchestrator/repositories/orchestrator-approval.repository";
import { OrchestratorApprovalKind } from "../../../shared/schemas/orchestrator-approval.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  CampaignLifecycleStatus,
  CampaignRoadmapStatus,
  CampaignEventType,
  PostFrequency,
} from "../../../shared/constants/campaign.constant";
import type { CampaignRoadmapItemSnapshot } from "../../../shared/schemas/campaign-roadmap.schema";

@injectable()
export class CampaignPlanningService {
  constructor(
    private campaignRepository: CampaignRepository,
    private roadmapRepository: CampaignRoadmapRepository,
    private memoryRepository: CampaignMemoryRepository,
    private eventRepository: CampaignEventRepository,
    private approvalRepository: OrchestratorApprovalRepository
  ) {}

  /**
   * Build a strategic roadmap from campaign fields (deterministic V1; LLM layer optional later).
   */
  async planCampaign(
    campaignId: string,
    siteId: string,
    userId: string,
    options?: { threadId?: string }
  ) {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    await this.memoryRepository.ensureForCampaign(campaignId, siteId);
    const total = campaign.total_posts_planned ?? this.estimatePostCount(campaign);
    const topics =
      campaign.primary_topics?.length
        ? campaign.primary_topics
        : campaign.ai_strategy?.content_themes?.length
          ? campaign.ai_strategy.content_themes
          : [campaign.goal.slice(0, 80)];

    const slots = this.distributeScheduleDates(
      campaign.start_date,
      campaign.end_date,
      total,
      campaign.posting_frequency
    );

    const items: CampaignRoadmapItemSnapshot[] = slots.map((scheduled_at, idx) => {
      const topic = topics[idx % topics.length];
      return {
        title: `${topic} — Part ${idx + 1}`,
        objective: `Support campaign goal: ${campaign.goal}`,
        strategic_intent: `Advance ${campaign.campaign_type ?? "custom"} narrative for ${campaign.target_audience ?? "target audience"}.`,
        sequence_index: idx,
        narrative_phase: idx === 0 ? "awareness" : idx < slots.length - 1 ? "consideration" : "conversion",
        scheduled_at,
      };
    });

    const version = await this.roadmapRepository.nextVersion(campaignId, siteId);
    const roadmap = await this.roadmapRepository.create({
      campaign_id: campaignId,
      site_id: siteId,
      version,
      status: CampaignRoadmapStatus.PROPOSED,
      generated_by: "ai",
      summary: `Roadmap with ${items.length} posts aligned to: ${campaign.goal}`,
      narrative_arc: `Progressive content arc from awareness through conversion over ${slots.length} publish slots.`,
      cadence_rationale: `Posts spaced using ${campaign.posting_frequency} cadence between ${campaign.start_date.toISOString().slice(0, 10)} and ${campaign.end_date.toISOString().slice(0, 10)}.`,
      items,
      diversity_notes: `Topics rotated across: ${topics.join(", ")}.`,
      gap_analysis: "Review locked slots and adjust titles before approval.",
    });

    await this.campaignRepository.update(campaignId, siteId, {
      lifecycle_status: CampaignLifecycleStatus.AWAITING_APPROVAL,
      total_posts_planned: items.length,
    });

    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.ROADMAP_PROPOSED,
      actor_user_id: userId,
      payload: { version, item_count: items.length },
    });

    await this.approvalRepository.create({
      site_id: siteId,
      thread_id: options?.threadId,
      requested_for_user_id: userId,
      requested_by_user_id: userId,
      kind: OrchestratorApprovalKind.CAMPAIGN_ROADMAP_APPROVAL,
      action: "campaign.approveRoadmap",
      summary: `Approve roadmap v${version} (${items.length} posts) for "${campaign.name}".`,
      payload: {
        campaign_id: campaignId,
        roadmap_id: roadmap._id!.toString(),
        version,
      },
    });

    logger.info("Campaign roadmap proposed", { campaignId, version }, "CampaignPlanningService");
    return roadmap;
  }

  private estimatePostCount(campaign: { start_date: Date; end_date: Date; posting_frequency: PostFrequency }) {
    const days = Math.max(
      7,
      Math.ceil((campaign.end_date.getTime() - campaign.start_date.getTime()) / 86400000)
    );
    switch (campaign.posting_frequency) {
      case PostFrequency.DAILY:
        return Math.min(days, 30);
      case PostFrequency.WEEKLY:
        return Math.max(4, Math.ceil(days / 7));
      case PostFrequency.BIWEEKLY:
        return Math.max(2, Math.ceil(days / 14));
      case PostFrequency.MONTHLY:
        return Math.max(2, Math.ceil(days / 30));
      default:
        return 8;
    }
  }

  private distributeScheduleDates(
    start: Date,
    end: Date,
    count: number,
    frequency: PostFrequency
  ): Date[] {
    if (count <= 0) {
      throw new BadRequestError("Campaign must plan at least one post");
    }
    const span = end.getTime() - start.getTime();
    const step =
      frequency === PostFrequency.DAILY
        ? 86400000
        : frequency === PostFrequency.WEEKLY
          ? 7 * 86400000
          : frequency === PostFrequency.BIWEEKLY
            ? 14 * 86400000
            : span / Math.max(1, count - 1);

    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const t = Math.min(start.getTime() + i * step, end.getTime());
      dates.push(new Date(t));
    }
    return dates;
  }
}
