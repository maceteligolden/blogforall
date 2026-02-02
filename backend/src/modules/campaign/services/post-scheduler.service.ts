import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { BlogService } from "../../blog/services/blog.service";
import { BlogGenerationService } from "../../blog/services/blog-generation.service";
import { ScheduledPostStatus, CampaignStatus } from "../../../shared/constants/campaign.constant";
import { BlogStatus } from "../../../shared/constants";
import { logger } from "../../../shared/utils/logger";
import { NotFoundError } from "../../../shared/errors";

@injectable()
export class PostSchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly SCHEDULE_INTERVAL = process.env.SCHEDULER_INTERVAL || "*/1 * * * *"; // Every minute by default

  constructor(
    private scheduledPostRepository: ScheduledPostRepository,
    private campaignRepository: CampaignRepository,
    private blogRepository: BlogRepository,
    private blogService: BlogService,
    private blogGenerationService: BlogGenerationService
  ) {}

  /**
   * Start the scheduler cron job
   */
  start(): void {
    if (this.cronJob) {
      logger.warn("Scheduler is already running", {}, "PostSchedulerService");
      return;
    }

    // Run every minute by default (configurable via SCHEDULER_INTERVAL env var)
    this.cronJob = cron.schedule(this.SCHEDULE_INTERVAL, async () => {
      await this.processScheduledPosts();
    });

    logger.info(`Post scheduler started with interval: ${this.SCHEDULE_INTERVAL}`, {}, "PostSchedulerService");
  }

  /**
   * Stop the scheduler cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Post scheduler stopped", {}, "PostSchedulerService");
    }
  }

  /**
   * Process all pending scheduled posts that are due
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const now = new Date();
      const pendingPosts = await this.scheduledPostRepository.findPendingPosts(100); // Process up to 100 at a time

      if (pendingPosts.length === 0) {
        return; // No posts to process
      }

      logger.info(`Processing ${pendingPosts.length} scheduled posts`, {}, "PostSchedulerService");

      // Process posts in parallel (with concurrency limit)
      const batchSize = 10;
      for (let i = 0; i < pendingPosts.length; i += batchSize) {
        const batch = pendingPosts.slice(i, i + batchSize);
        await Promise.allSettled(batch.map((post) => this.executeScheduledPost(post._id!.toString())));
      }
    } catch (error) {
      logger.error("Error processing scheduled posts", error as Error, {}, "PostSchedulerService");
    }
  }

  /**
   * Execute a single scheduled post
   */
  async executeScheduledPost(scheduledPostId: string): Promise<void> {
    const scheduledPost = await this.scheduledPostRepository.findById(scheduledPostId);
    
    if (!scheduledPost) {
      logger.error(`Scheduled post not found: ${scheduledPostId}`, {}, "PostSchedulerService");
      return;
    }

    // Skip if already published or cancelled
    if (scheduledPost.status === ScheduledPostStatus.PUBLISHED || 
        scheduledPost.status === ScheduledPostStatus.CANCELLED) {
      return;
    }

    // Check if it's time to publish
    const now = new Date();
    if (scheduledPost.scheduled_at > now) {
      return; // Not yet time to publish
    }

    // Check retry limit
    if (scheduledPost.publish_attempts >= this.MAX_RETRY_ATTEMPTS) {
      await this.scheduledPostRepository.markAsFailed(
        scheduledPostId,
        `Failed after ${this.MAX_RETRY_ATTEMPTS} attempts`
      );
      logger.error(
        `Scheduled post ${scheduledPostId} exceeded max retry attempts`,
        {},
        "PostSchedulerService"
      );
      return;
    }

    try {
      // Increment attempt count
      await this.scheduledPostRepository.incrementAttempts(scheduledPostId);

      let blogId: string | undefined;

      if (scheduledPost.blog_id) {
        // Case 1: Blog already exists, just publish it
        blogId = scheduledPost.blog_id;
        const blog = await this.blogRepository.findById(blogId, scheduledPost.site_id);
        
        if (!blog) {
          throw new NotFoundError(`Blog ${blogId} not found for scheduled post ${scheduledPostId}`);
        }

        // Publish the blog if not already published
        if (blog.status !== BlogStatus.PUBLISHED) {
          await this.blogService.publishBlog(blogId, scheduledPost.site_id, scheduledPost.user_id);
          logger.info(`Published blog ${blogId} for scheduled post ${scheduledPostId}`, {}, "PostSchedulerService");
        }
      } else if (scheduledPost.auto_generate && scheduledPost.generation_prompt) {
        // Case 2: Auto-generate blog content and then publish
        logger.info(`Generating content for scheduled post ${scheduledPostId}`, {}, "PostSchedulerService");
        
        try {
          // Analyze prompt first
          const analysis = await this.blogGenerationService.analyzePrompt(scheduledPost.generation_prompt);
          
          if (!analysis.is_valid) {
            throw new Error(`Invalid generation prompt: ${analysis.rejection_reason || "Unknown error"}`);
          }

          // Generate blog content
          const generatedContent = await this.blogGenerationService.generateBlogContent(
            scheduledPost.generation_prompt,
            analysis
          );

          // Create the blog post
          const blog = await this.blogService.createBlog(scheduledPost.user_id, scheduledPost.site_id, {
            title: scheduledPost.title || generatedContent.title,
            content: generatedContent.content,
            excerpt: generatedContent.excerpt,
            status: BlogStatus.PUBLISHED, // Publish directly
          });

          blogId = blog._id!.toString();

          // Update scheduled post with the new blog_id
          await this.scheduledPostRepository.update(scheduledPostId, scheduledPost.site_id, {
            blog_id: blogId,
          });

          logger.info(
            `Generated and published blog ${blogId} for scheduled post ${scheduledPostId}`,
            {},
            "PostSchedulerService"
          );
        } catch (generationError) {
          logger.error(
            `Failed to generate content for scheduled post ${scheduledPostId}`,
            generationError as Error,
            {},
            "PostSchedulerService"
          );
          throw generationError; // Re-throw to be caught by outer catch
        }
      } else {
        throw new Error("Scheduled post has neither a blog_id nor a valid generation_prompt");
      }

      // Mark as published
      await this.scheduledPostRepository.markAsPublished(scheduledPostId, new Date());

      // Update campaign stats if part of a campaign
      if (scheduledPost.campaign_id) {
        await this.campaignRepository.updatePostsPublished(scheduledPost.campaign_id, 1);
        
        // Check if campaign should be marked as completed
        const campaign = await this.campaignRepository.findById(scheduledPost.campaign_id, scheduledPost.site_id);
        if (campaign && campaign.end_date <= now && campaign.status === CampaignStatus.ACTIVE) {
          await this.campaignRepository.update(scheduledPost.campaign_id, scheduledPost.site_id, {
            status: CampaignStatus.COMPLETED,
          });
          logger.info(`Campaign ${scheduledPost.campaign_id} marked as completed`, {}, "PostSchedulerService");
        }
      }

      logger.info(`Successfully executed scheduled post ${scheduledPostId}`, { blogId }, "PostSchedulerService");
    } catch (error) {
      logger.error(
        `Failed to execute scheduled post ${scheduledPostId}`,
        error as Error,
        { attempts: scheduledPost.publish_attempts + 1 },
        "PostSchedulerService"
      );

      // Mark as failed if exceeded retry limit
      if (scheduledPost.publish_attempts + 1 >= this.MAX_RETRY_ATTEMPTS) {
        await this.scheduledPostRepository.markAsFailed(
          scheduledPostId,
          (error as Error).message || "Unknown error"
        );
      } else {
        // Just update error message for retry
        await this.scheduledPostRepository.update(scheduledPostId, scheduledPost.site_id, {
          error_message: (error as Error).message || "Unknown error",
        });
      }
    }
  }

  /**
   * Manually trigger processing of scheduled posts (useful for testing or manual execution)
   */
  async triggerProcessing(): Promise<void> {
    logger.info("Manually triggering scheduled post processing", {}, "PostSchedulerService");
    await this.processScheduledPosts();
  }
}
