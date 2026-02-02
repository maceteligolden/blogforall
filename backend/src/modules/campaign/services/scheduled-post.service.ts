import { injectable } from "tsyringe";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateScheduledPostInput, UpdateScheduledPostInput, ScheduledPostQueryFilters } from "../interfaces/scheduled-post.interface";
import { ScheduledPost, ScheduledPost as ScheduledPostType } from "../../../shared/schemas/scheduled-post.schema";
import { ScheduledPostStatus, CampaignStatus } from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";

@injectable()
export class ScheduledPostService {
  constructor(
    private scheduledPostRepository: ScheduledPostRepository,
    private campaignRepository: CampaignRepository,
    private blogRepository: BlogRepository
  ) {}

  async createScheduledPost(
    userId: string,
    siteId: string,
    input: CreateScheduledPostInput
  ): Promise<ScheduledPost> {
    // Validate scheduled date
    if (input.scheduled_at < new Date()) {
      throw new BadRequestError("Scheduled date cannot be in the past");
    }

    // Validate blog if provided
    if (input.blog_id) {
      const blog = await this.blogRepository.findById(input.blog_id, siteId);
      if (!blog) {
        throw new NotFoundError("Blog not found");
      }
      if (blog.author !== userId) {
        throw new ForbiddenError("You don't have permission to schedule this blog");
      }

      // Check if blog is already scheduled
      const isScheduled = await this.scheduledPostRepository.isBlogScheduled(input.blog_id);
      if (isScheduled) {
        throw new BadRequestError("This blog is already scheduled");
      }
    }

    // Validate campaign if provided
    if (input.campaign_id) {
      const campaign = await this.campaignRepository.findById(input.campaign_id, siteId);
      if (!campaign) {
        throw new NotFoundError("Campaign not found");
      }
      if (campaign.user_id !== userId) {
        throw new ForbiddenError("You don't have permission to schedule posts for this campaign");
      }
      if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.COMPLETED) {
        throw new BadRequestError("Cannot schedule posts for cancelled or completed campaign");
      }
    }

    const timezone = input.timezone || "UTC";

    const scheduledPost = await this.scheduledPostRepository.create({
      ...input,
      user_id: userId,
      site_id: siteId,
      timezone,
      status: ScheduledPostStatus.PENDING,
      publish_attempts: 0,
      auto_generate: input.auto_generate || false,
    });

    logger.info("Scheduled post created", { 
      scheduledPostId: scheduledPost._id, 
      userId, 
      siteId,
      campaignId: input.campaign_id,
      blogId: input.blog_id,
    }, "ScheduledPostService");

    return scheduledPost;
  }

  async getScheduledPostById(
    scheduledPostId: string,
    siteId: string,
    userId?: string
  ): Promise<ScheduledPost> {
    const post = await this.scheduledPostRepository.findById(scheduledPostId, siteId);
    if (!post) {
      throw new NotFoundError("Scheduled post not found");
    }

    if (userId && post.user_id !== userId) {
      throw new ForbiddenError("You don't have permission to access this scheduled post");
    }

    return post;
  }

  async getScheduledPosts(
    userId: string,
    siteId: string,
    filters?: ScheduledPostQueryFilters
  ): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findByUser(userId, siteId, filters);
  }

  async getAllScheduledPosts(
    siteId: string,
    filters?: ScheduledPostQueryFilters
  ): Promise<PaginatedResponse<ScheduledPost>> {
    return this.scheduledPostRepository.findAll(siteId, filters);
  }

  async getScheduledPostsByDateRange(
    siteId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findByDateRange(siteId, startDate, endDate);
  }

  async updateScheduledPost(
    scheduledPostId: string,
    siteId: string,
    userId: string,
    input: UpdateScheduledPostInput
  ): Promise<ScheduledPost> {
    const post = await this.getScheduledPostById(scheduledPostId, siteId, userId);

    // Prevent updating published or cancelled posts
    if (post.status === ScheduledPostStatus.PUBLISHED) {
      throw new BadRequestError("Cannot update already published post");
    }
    if (post.status === ScheduledPostStatus.CANCELLED) {
      throw new BadRequestError("Cannot update cancelled post");
    }

    // Validate scheduled date if updating
    if (input.scheduled_at) {
      if (input.scheduled_at < new Date()) {
        throw new BadRequestError("Scheduled date cannot be in the past");
      }
    }

    // Validate blog if updating
    if (input.blog_id && input.blog_id !== post.blog_id) {
      const blog = await this.blogRepository.findById(input.blog_id, siteId);
      if (!blog) {
        throw new NotFoundError("Blog not found");
      }
      if (blog.author !== userId) {
        throw new ForbiddenError("You don't have permission to schedule this blog");
      }

      // Check if new blog is already scheduled
      const isScheduled = await this.scheduledPostRepository.isBlogScheduled(input.blog_id);
      if (isScheduled) {
        throw new BadRequestError("This blog is already scheduled");
      }
    }

    const updatedPost = await this.scheduledPostRepository.update(scheduledPostId, siteId, input);
    if (!updatedPost) {
      throw new NotFoundError("Scheduled post not found");
    }

    logger.info("Scheduled post updated", { scheduledPostId, userId, siteId }, "ScheduledPostService");
    return updatedPost;
  }

  async deleteScheduledPost(scheduledPostId: string, siteId: string, userId: string): Promise<void> {
    const post = await this.getScheduledPostById(scheduledPostId, siteId, userId);

    // Prevent deleting published posts
    if (post.status === ScheduledPostStatus.PUBLISHED) {
      throw new BadRequestError("Cannot delete already published post");
    }

    const deleted = await this.scheduledPostRepository.delete(scheduledPostId, siteId);
    if (!deleted) {
      throw new NotFoundError("Scheduled post not found");
    }

    logger.info("Scheduled post deleted", { scheduledPostId, userId, siteId }, "ScheduledPostService");
  }

  async cancelScheduledPost(scheduledPostId: string, siteId: string, userId: string): Promise<ScheduledPost> {
    const post = await this.getScheduledPostById(scheduledPostId, siteId, userId);

    if (post.status === ScheduledPostStatus.CANCELLED) {
      return post;
    }

    if (post.status === ScheduledPostStatus.PUBLISHED) {
      throw new BadRequestError("Cannot cancel already published post");
    }

    const updatedPost = await this.scheduledPostRepository.update(scheduledPostId, siteId, {
      status: ScheduledPostStatus.CANCELLED,
    });

    if (!updatedPost) {
      throw new NotFoundError("Scheduled post not found");
    }

    logger.info("Scheduled post cancelled", { scheduledPostId, userId, siteId }, "ScheduledPostService");
    return updatedPost;
  }

  async moveToCampaign(
    scheduledPostId: string,
    siteId: string,
    userId: string,
    campaignId: string
  ): Promise<ScheduledPost> {
    const post = await this.getScheduledPostById(scheduledPostId, siteId, userId);
    const campaign = await this.campaignRepository.findById(campaignId, siteId);

    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    if (campaign.user_id !== userId) {
      throw new ForbiddenError("You don't have permission to add posts to this campaign");
    }

    if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestError("Cannot add posts to cancelled or completed campaign");
    }

    const updatedPost = await this.scheduledPostRepository.update(scheduledPostId, siteId, {
      campaign_id: campaignId,
      metadata: {
        ...post.metadata,
        campaign_goal: campaign.goal,
        target_audience: campaign.target_audience,
      },
    });

    if (!updatedPost) {
      throw new NotFoundError("Scheduled post not found");
    }

    logger.info("Scheduled post moved to campaign", { 
      scheduledPostId, 
      campaignId, 
      userId, 
      siteId 
    }, "ScheduledPostService");

    return updatedPost;
  }

  async removeFromCampaign(
    scheduledPostId: string,
    siteId: string,
    userId: string
  ): Promise<ScheduledPost> {
    const post = await this.getScheduledPostById(scheduledPostId, siteId, userId);

    if (!post.campaign_id) {
      throw new BadRequestError("Post is not part of a campaign");
    }

    const updatedPost = await this.scheduledPostRepository.update(scheduledPostId, siteId, {
      campaign_id: undefined,
    });

    if (!updatedPost) {
      throw new NotFoundError("Scheduled post not found");
    }

    logger.info("Scheduled post removed from campaign", { scheduledPostId, userId, siteId }, "ScheduledPostService");
    return updatedPost;
  }

  async isBlogScheduled(blogId: string): Promise<boolean> {
    return this.scheduledPostRepository.isBlogScheduled(blogId);
  }

  async getPendingPosts(limit: number = 100): Promise<ScheduledPost[]> {
    return this.scheduledPostRepository.findPendingPosts(limit);
  }
}
