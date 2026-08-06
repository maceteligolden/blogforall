import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignQueryFilters,
  CampaignWithStats,
} from "../interfaces/campaign.interface";
import { Campaign } from "../../../shared/schemas/campaign.schema";
import Blog from "../../../shared/schemas/blog.schema";
import ScheduledPost from "../../../shared/schemas/scheduled-post.schema";
import {
  CampaignStatus,
  ScheduledPostStatus,
  CampaignLifecycleStatus,
  CampaignContentAutonomy,
  CampaignPublishingMode,
  CampaignApprovalPolicy,
  PostFrequency,
  CampaignType,
} from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";
import { env } from "../../../shared/config/env";
import { WorkspaceStrategyService } from "../../strategic-intelligence/services/workspace-strategy.service";
import CampaignModel from "../../../shared/schemas/campaign.schema";

@injectable()
export class CampaignService {
  constructor(
    private campaignRepository: CampaignRepository,
    private scheduledPostRepository: ScheduledPostRepository,
    private workspaceStrategy: WorkspaceStrategyService
  ) {}

  private async resolveStrategyId(siteId: string, userId: string, pinned?: string): Promise<string | undefined> {
    if (!env.orchestrator.strategicIntelligenceEnabled) return pinned;
    if (pinned) return pinned;
    const strategy = await this.workspaceStrategy.ensureStrategy(siteId, userId);
    return strategy._id?.toString();
  }

  /**
   * Ensure the site has exactly one Default (Evergreen) campaign.
   * Used when Strategic Intelligence is enabled (doc 21).
   */
  async ensureDefaultCampaign(siteId: string, userId: string): Promise<Campaign> {
    const existing = await this.campaignRepository.findDefault(siteId);
    if (existing) {
      if (!existing.strategy_id && env.orchestrator.strategicIntelligenceEnabled) {
        const strategyId = await this.resolveStrategyId(siteId, userId);
        if (strategyId) {
          return (await this.campaignRepository.update(existing._id!.toString(), siteId, {
            strategy_id: strategyId,
          })) as Campaign;
        }
      }
      return existing;
    }

    const now = new Date();
    const end = new Date(now);
    end.setFullYear(end.getFullYear() + 10);
    const strategyId = await this.resolveStrategyId(siteId, userId);

    try {
      const campaign = await this.campaignRepository.create({
        user_id: userId,
        site_id: siteId,
        name: "Evergreen",
        description: "Default campaign for content that is not part of a time-bounded campaign.",
        goal: "Evergreen content aligned with the workspace strategy",
        status: CampaignStatus.ACTIVE,
        lifecycle_status: CampaignLifecycleStatus.ACTIVE,
        campaign_type: CampaignType.CUSTOM,
        is_default: true,
        strategy_id: strategyId,
        content_autonomy: CampaignContentAutonomy.ASSISTED,
        publishing_mode: CampaignPublishingMode.SCHEDULED_HITL,
        approval_policy: CampaignApprovalPolicy.REQUIRE_PRE_PUBLISH_APPROVAL,
        notifications: { daily_progress_email: false },
        start_date: now,
        end_date: end,
        posting_frequency: PostFrequency.WEEKLY,
        timezone: "UTC",
        posts_published: 0,
        funnel_focus: "full_funnel",
      });
      logger.info("Default campaign created", { campaignId: campaign._id, siteId }, "CampaignService");
      return campaign;
    } catch (err) {
      // Race: another request may have created the default.
      const raced = await this.campaignRepository.findDefault(siteId);
      if (raced) return raced;
      throw err;
    }
  }

  /**
   * Assign unbound blogs and scheduled posts to the Default campaign.
   */
  async backfillContentToDefault(siteId: string, userId: string): Promise<{ blogs: number; scheduled: number }> {
    const def = await this.ensureDefaultCampaign(siteId, userId);
    const id = def._id!.toString();
    const blogRes = await Blog.updateMany(
      { site_id: siteId, $or: [{ campaign_id: { $exists: false } }, { campaign_id: null }, { campaign_id: "" }] },
      { $set: { campaign_id: id } }
    );
    const schedRes = await ScheduledPost.updateMany(
      { site_id: siteId, $or: [{ campaign_id: { $exists: false } }, { campaign_id: null }, { campaign_id: "" }] },
      { $set: { campaign_id: id } }
    );
    return {
      blogs: blogRes.modifiedCount ?? 0,
      scheduled: schedRes.modifiedCount ?? 0,
    };
  }

  /** Backfill strategy_id on campaigns missing it (inherit active WorkspaceStrategy). */
  async backfillStrategyIds(siteId: string, userId: string): Promise<number> {
    if (!env.orchestrator.strategicIntelligenceEnabled) return 0;
    const strategyId = await this.resolveStrategyId(siteId, userId);
    if (!strategyId) return 0;
    const res = await CampaignModel.updateMany(
      { site_id: siteId, $or: [{ strategy_id: { $exists: false } }, { strategy_id: null }, { strategy_id: "" }] },
      { $set: { strategy_id: strategyId } }
    );
    return res.modifiedCount ?? 0;
  }

  async createCampaign(userId: string, siteId: string, input: CreateCampaignInput): Promise<Campaign> {
    if (input.start_date >= input.end_date) {
      throw new BadRequestError("End date must be after start date");
    }

    if (input.start_date < new Date()) {
      throw new BadRequestError("Start date cannot be in the past");
    }

    const timezone = input.timezone || "UTC";

    if (env.orchestrator.strategicIntelligenceEnabled) {
      await this.ensureDefaultCampaign(siteId, userId);
    }

    const strategyId = await this.resolveStrategyId(siteId, userId, input.strategy_id);

    const campaign = await this.campaignRepository.create({
      ...input,
      user_id: userId,
      site_id: siteId,
      status: CampaignStatus.DRAFT,
      lifecycle_status: CampaignLifecycleStatus.DRAFT,
      content_autonomy: CampaignContentAutonomy.ASSISTED,
      publishing_mode: CampaignPublishingMode.SCHEDULED_HITL,
      approval_policy: CampaignApprovalPolicy.REQUIRE_PRE_PUBLISH_APPROVAL,
      notifications: { daily_progress_email: true },
      timezone,
      posts_published: 0,
      is_default: false,
      strategy_id: strategyId,
    });

    logger.info("Campaign created", { campaignId: campaign._id, userId, siteId }, "CampaignService");
    return campaign;
  }

  async getCampaignById(campaignId: string, siteId: string, userId?: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    if (userId && campaign.user_id !== userId) {
      throw new ForbiddenError("You don't have permission to access this campaign");
    }

    return campaign;
  }

  async getCampaigns(userId: string, siteId: string, filters?: CampaignQueryFilters): Promise<Campaign[]> {
    return this.campaignRepository.findByUser(userId, siteId, filters);
  }

  async getAllCampaigns(siteId: string, filters?: CampaignQueryFilters): Promise<PaginatedResponse<Campaign>> {
    return this.campaignRepository.findAll(siteId, filters);
  }

  async getCampaignWithStats(campaignId: string, siteId: string, userId?: string): Promise<CampaignWithStats> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    const [postsScheduled, postsPending] = await Promise.all([
      this.scheduledPostRepository.countByCampaign(campaignId, ScheduledPostStatus.SCHEDULED),
      this.scheduledPostRepository.countByCampaign(campaignId, ScheduledPostStatus.PENDING),
    ]);

    return {
      _id: campaign._id!,
      name: campaign.name,
      description: campaign.description,
      goal: campaign.goal,
      target_audience: campaign.target_audience,
      status: campaign.status,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      posting_frequency: campaign.posting_frequency,
      timezone: campaign.timezone,
      total_posts_planned: campaign.total_posts_planned,
      posts_published: campaign.posts_published,
      posts_scheduled: postsScheduled,
      posts_pending: postsPending,
      created_at: campaign.created_at!,
      updated_at: campaign.updated_at!,
    };
  }

  async updateCampaign(
    campaignId: string,
    siteId: string,
    userId: string,
    input: UpdateCampaignInput
  ): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (input.start_date || input.end_date) {
      const startDate = input.start_date || campaign.start_date;
      const endDate = input.end_date || campaign.end_date;

      if (startDate >= endDate) {
        throw new BadRequestError("End date must be after start date");
      }
    }

    if (
      input.status === CampaignStatus.DRAFT &&
      (campaign.status === CampaignStatus.ACTIVE || campaign.status === CampaignStatus.COMPLETED)
    ) {
      throw new BadRequestError("Cannot change active or completed campaign to draft");
    }

    const updatedCampaign = await this.campaignRepository.update(campaignId, siteId, input);
    if (!updatedCampaign) {
      throw new NotFoundError("Campaign not found");
    }

    logger.info("Campaign updated", { campaignId, userId, siteId }, "CampaignService");
    return updatedCampaign;
  }

  async deleteCampaign(campaignId: string, siteId: string, userId: string): Promise<void> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.is_default) {
      throw new BadRequestError("Cannot delete the Default (Evergreen) campaign");
    }

    const scheduledPosts = await this.scheduledPostRepository.findByCampaign(campaignId, siteId);
    const hasActivePosts = scheduledPosts.some(
      (post) => post.status === ScheduledPostStatus.PENDING || post.status === ScheduledPostStatus.SCHEDULED
    );

    if (hasActivePosts) {
      throw new BadRequestError(
        "Cannot delete campaign with active scheduled posts. Please cancel or complete scheduled posts first."
      );
    }

    for (const post of scheduledPosts) {
      await this.scheduledPostRepository.update(post._id!.toString(), siteId, {
        status: ScheduledPostStatus.CANCELLED,
      });
    }

    const deleted = await this.campaignRepository.delete(campaignId, siteId);
    if (!deleted) {
      throw new NotFoundError("Campaign not found");
    }

    logger.info("Campaign deleted", { campaignId, userId, siteId }, "CampaignService");
  }

  async activateCampaign(campaignId: string, siteId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.status === CampaignStatus.ACTIVE) {
      return campaign;
    }

    if (campaign.status === CampaignStatus.COMPLETED || campaign.status === CampaignStatus.CANCELLED) {
      throw new BadRequestError("Cannot activate completed or cancelled campaign");
    }

    if (campaign.end_date < new Date() && !campaign.is_default) {
      throw new BadRequestError("Cannot activate campaign with end date in the past");
    }

    return this.updateCampaign(campaignId, siteId, userId, {
      status: CampaignStatus.ACTIVE,
      lifecycle_status: CampaignLifecycleStatus.ACTIVE,
    });
  }

  async pauseCampaign(campaignId: string, siteId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.is_default) {
      throw new BadRequestError("Cannot pause the Default (Evergreen) campaign");
    }

    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestError("Only active campaigns can be paused");
    }

    return this.updateCampaign(campaignId, siteId, userId, { status: CampaignStatus.PAUSED });
  }

  async cancelCampaign(campaignId: string, siteId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.is_default) {
      throw new BadRequestError("Cannot cancel the Default (Evergreen) campaign");
    }

    if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestError("Campaign is already cancelled or completed");
    }

    const scheduledPosts = await this.scheduledPostRepository.findByCampaign(campaignId, siteId);
    for (const post of scheduledPosts) {
      if (post.status === ScheduledPostStatus.PENDING || post.status === ScheduledPostStatus.SCHEDULED) {
        await this.scheduledPostRepository.update(post._id!.toString(), siteId, {
          status: ScheduledPostStatus.CANCELLED,
        });
      }
    }

    return this.updateCampaign(campaignId, siteId, userId, { status: CampaignStatus.CANCELLED });
  }

  async getCampaignsByDateRange(siteId: string, startDate: Date, endDate: Date): Promise<Campaign[]> {
    return this.campaignRepository.findByDateRange(siteId, startDate, endDate);
  }
}
