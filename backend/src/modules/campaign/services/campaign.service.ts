import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateCampaignInput, UpdateCampaignInput, CampaignQueryFilters, CampaignWithStats } from "../interfaces/campaign.interface";
import { Campaign, Campaign as CampaignType } from "../../../shared/schemas/campaign.schema";
import { CampaignStatus, ScheduledPostStatus } from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class CampaignService {
  constructor(
    private campaignRepository: CampaignRepository,
    private scheduledPostRepository: ScheduledPostRepository
  ) {}

  async createCampaign(userId: string, siteId: string, input: CreateCampaignInput): Promise<Campaign> {
    // Validate dates
    if (input.start_date >= input.end_date) {
      throw new BadRequestError("End date must be after start date");
    }

    if (input.start_date < new Date()) {
      throw new BadRequestError("Start date cannot be in the past");
    }

    // Validate timezone
    const timezone = input.timezone || "UTC";

    const campaign = await this.campaignRepository.create({
      ...input,
      user_id: userId,
      site_id: siteId,
      status: CampaignStatus.DRAFT,
      timezone,
      posts_published: 0,
    });

    logger.info("Campaign created", { campaignId: campaign._id, userId, siteId }, "CampaignService");
    return campaign;
  }

  async getCampaignById(campaignId: string, siteId: string, userId?: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    // If userId is provided, ensure the campaign belongs to the user
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

    // Validate dates if updating
    if (input.start_date || input.end_date) {
      const startDate = input.start_date || campaign.start_date;
      const endDate = input.end_date || campaign.end_date;
      
      if (startDate >= endDate) {
        throw new BadRequestError("End date must be after start date");
      }
    }

    // Prevent updating active/completed campaigns to draft
    if (input.status === CampaignStatus.DRAFT && 
        (campaign.status === CampaignStatus.ACTIVE || campaign.status === CampaignStatus.COMPLETED)) {
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

    // Check if campaign has scheduled posts
    const scheduledPosts = await this.scheduledPostRepository.findByCampaign(campaignId, siteId);
    const hasActivePosts = scheduledPosts.some(
      post => post.status === ScheduledPostStatus.PENDING || post.status === ScheduledPostStatus.SCHEDULED
    );

    if (hasActivePosts) {
      throw new BadRequestError("Cannot delete campaign with active scheduled posts. Please cancel or complete scheduled posts first.");
    }

    // Cancel all scheduled posts
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

    // Validate dates
    if (campaign.end_date < new Date()) {
      throw new BadRequestError("Cannot activate campaign with end date in the past");
    }

    return this.updateCampaign(campaignId, siteId, userId, { status: CampaignStatus.ACTIVE });
  }

  async pauseCampaign(campaignId: string, siteId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestError("Only active campaigns can be paused");
    }

    return this.updateCampaign(campaignId, siteId, userId, { status: CampaignStatus.PAUSED });
  }

  async cancelCampaign(campaignId: string, siteId: string, userId: string): Promise<Campaign> {
    const campaign = await this.getCampaignById(campaignId, siteId, userId);

    if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestError("Campaign is already cancelled or completed");
    }

    // Cancel all pending/scheduled posts
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
