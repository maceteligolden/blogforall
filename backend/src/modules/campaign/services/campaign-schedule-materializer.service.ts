import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  CampaignLifecycleStatus,
  CampaignPostItemStatus,
  ScheduledPostStatus,
  CampaignEventType,
} from "../../../shared/constants/campaign.constant";

/**
 * Creates ScheduledPost rows from approved campaign items.
 * Never sets approved_at — inherits HITL prepare → approve → publish pipeline.
 */
@injectable()
export class CampaignScheduleMaterializerService {
  constructor(
    private campaignRepository: CampaignRepository,
    private postItemRepository: CampaignPostItemRepository,
    private scheduledPostRepository: ScheduledPostRepository,
    private eventRepository: CampaignEventRepository
  ) {}

  async materialize(campaignId: string, siteId: string, userId: string): Promise<number> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }
    if (campaign.lifecycle_status === CampaignLifecycleStatus.PAUSED) {
      return 0;
    }

    const items = await this.postItemRepository.findByCampaign(campaignId, siteId);
    let created = 0;

    for (const item of items) {
      if (item.scheduled_post_id) {
        continue;
      }
      if (!item.scheduled_at) {
        continue;
      }

      const scheduledPost = await this.scheduledPostRepository.create({
        user_id: userId,
        site_id: siteId,
        campaign_id: campaignId,
        title: item.title,
        scheduled_at: item.scheduled_at,
        timezone: item.timezone || campaign.timezone,
        status: ScheduledPostStatus.PENDING,
        auto_generate: true,
        generation_prompt: [
          `Campaign goal: ${campaign.goal}`,
          `Post objective: ${item.objective}`,
          `Strategic intent: ${item.strategic_intent}`,
          item.target_keywords?.length
            ? `Keywords: ${item.target_keywords.join(", ")}`
            : "",
          campaign.cta_strategy?.primary_cta
            ? `CTA: ${campaign.cta_strategy.primary_cta}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        metadata: {
          campaign_goal: campaign.goal,
          target_audience: campaign.target_audience,
          content_theme: item.content_angle ?? item.title,
          campaign_post_item_id: item._id!.toString(),
        },
        publish_attempts: 0,
        rework_round: 0,
      });

      await this.postItemRepository.update(item._id!.toString(), siteId, {
        scheduled_post_id: scheduledPost._id!.toString(),
        status: CampaignPostItemStatus.SCHEDULED,
      });

      await this.eventRepository.append({
        campaign_id: campaignId,
        site_id: siteId,
        type: CampaignEventType.POST_SCHEDULED,
        actor_user_id: userId,
        payload: { item_id: item._id, scheduled_post_id: scheduledPost._id },
      });

      created++;
    }

    logger.info("Campaign schedule materialized", { campaignId, created }, "CampaignScheduleMaterializerService");
    return created;
  }
}
