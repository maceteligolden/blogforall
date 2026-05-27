import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import {
  CampaignHealthStatus,
  CampaignLifecycleStatus,
  CampaignPostItemStatus,
  CampaignStatus,
} from "../../../shared/constants/campaign.constant";
import type { Campaign } from "../../../shared/schemas/campaign.schema";

export interface CampaignHealthResult {
  health_status: CampaignHealthStatus;
  health_reasons: string[];
}

@injectable()
export class CampaignHealthService {
  constructor(
    private campaignRepository: CampaignRepository,
    private postItemRepository: CampaignPostItemRepository,
    private scheduledPostRepository: ScheduledPostRepository
  ) {}

  async compute(campaign: Campaign): Promise<CampaignHealthResult> {
    const reasons: string[] = [];
    const now = new Date();
    const items = await this.postItemRepository.findByCampaign(
      campaign._id!.toString(),
      campaign.site_id
    );
    const total = items.length || campaign.total_posts_planned || 0;
    const published = items.filter((i) => i.status === CampaignPostItemStatus.PUBLISHED).length;

    const pendingApprovalPosts = await this.scheduledPostRepository.findPendingApprovalsInWindow(
      new Date(0),
      new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      500
    );
    const campaignPending = pendingApprovalPosts.filter(
      (p) => p.campaign_id === campaign._id!.toString()
    );
    const overdueUnapproved = campaignPending.filter(
      (p) => p.scheduled_at <= now && !p.approved_at
    );

    if (overdueUnapproved.length > 0) {
      reasons.push(
        `${overdueUnapproved.length} post(s) passed scheduled date without approval — will not auto-publish.`
      );
    }
    if (campaignPending.length > 0) {
      reasons.push(`${campaignPending.length} post(s) awaiting your pre-publish approval.`);
    }

    const daysTotal = Math.max(
      1,
      Math.ceil((campaign.end_date.getTime() - campaign.start_date.getTime()) / 86400000)
    );
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.ceil((now.getTime() - campaign.start_date.getTime()) / 86400000))
    );
    const expectedPct = total > 0 ? (daysElapsed / daysTotal) * 100 : 0;
    const actualPct = total > 0 ? (published / total) * 100 : 0;

    let health = CampaignHealthStatus.ON_TRACK;
    if (overdueUnapproved.length > 0 || campaignPending.length >= 3) {
      health = CampaignHealthStatus.AT_RISK;
    } else if (total > 0 && actualPct < expectedPct - 25) {
      health = CampaignHealthStatus.UNDERPERFORMING;
      reasons.push("Publishing pace is behind the campaign timeline.");
    } else if (total > 0 && actualPct > expectedPct + 15) {
      health = CampaignHealthStatus.EXCEEDING;
      reasons.push("Ahead of planned publishing pace.");
    }

    if (
      campaign.lifecycle_status === CampaignLifecycleStatus.PAUSED ||
      campaign.status === CampaignStatus.PAUSED
    ) {
      reasons.push("Campaign automation is paused.");
    }

    return { health_status: health, health_reasons: reasons };
  }

  async persist(campaignId: string, siteId: string): Promise<CampaignHealthResult> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      return { health_status: CampaignHealthStatus.UNKNOWN, health_reasons: [] };
    }
    const result = await this.compute(campaign);
    await this.campaignRepository.update(campaignId, siteId, {
      health_status: result.health_status,
      health_computed_at: new Date(),
      health_reasons: result.health_reasons,
    });
    return result;
  }
}
