import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { CampaignRepository } from "../repositories/campaign.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { BlogService } from "../../blog/services/blog.service";
import { ScheduledPostStatus, CampaignStatus } from "../../../shared/constants/campaign.constant";
import { BlogStatus } from "../../../shared/constants";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";
import { NotFoundError } from "../../../shared/errors";
import { ScheduledPostPrepareService } from "../../orchestrator/services/scheduled-post-prepare.service";

/**
 * Cron-driven scheduler for blog publication. Split across two phases so the
 * Workspace Orchestrator can enforce human-in-the-loop review before any post
 * goes live:
 *
 *  - prepare phase: delegated to ScheduledPostPrepareService. Picks up posts
 *    inside the review lead time, materializes a draft if needed, and
 *    transitions them to AWAITING_APPROVAL with a fresh review token.
 *  - publish phase: this service. Only publishes posts that are
 *    AWAITING_APPROVAL with an approved_at timestamp set by the human
 *    reviewer (via the email link or the approvals UI).
 *
 * Posts past their scheduled_at without approval stay AWAITING_APPROVAL
 * instead of auto-publishing.
 */
@injectable()
export class PostSchedulerService {
  private cronJob: cron.ScheduledTask | null = null;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly SCHEDULE_INTERVAL = env.scheduler.cronInterval;

  constructor(
    private scheduledPostRepository: ScheduledPostRepository,
    private campaignRepository: CampaignRepository,
    private blogRepository: BlogRepository,
    private blogService: BlogService,
    private prepareService: ScheduledPostPrepareService
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
      // Prepare drafts that are inside the review lead time first; then
      // publish approved posts. Order matters: a post that approval came in
      // for since the last tick will be picked up by the publish pass.
      await this.runPreparePhase();
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
   * Delegate to the prepare service; isolated here so a prepare-phase failure
   * cannot prevent the publish phase from running.
   */
  private async runPreparePhase(): Promise<void> {
    try {
      await this.prepareService.sweep();
    } catch (error) {
      logger.error(
        "Error in scheduled post prepare phase",
        error as Error,
        {},
        "PostSchedulerService"
      );
    }
  }

  /**
   * Publish posts that are AWAITING_APPROVAL with an approved_at timestamp
   * and have reached their scheduled_at. Posts past their scheduled time
   * without approval stay AWAITING_APPROVAL — they do NOT auto-publish.
   */
  private async processScheduledPosts(): Promise<void> {
    try {
      const readyPosts = await this.scheduledPostRepository.findReadyForPublication(100);

      if (readyPosts.length === 0) {
        return;
      }

      logger.info(
        `Publishing ${readyPosts.length} approved scheduled post(s)`,
        {},
        "PostSchedulerService"
      );

      const batchSize = 10;
      for (let i = 0; i < readyPosts.length; i += batchSize) {
        const batch = readyPosts.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map((post) => this.executeScheduledPost(post._id!.toString()))
        );
      }
    } catch (error) {
      logger.error("Error processing scheduled posts", error, {}, "PostSchedulerService");
    }
  }

  /**
   * Publish a single approved scheduled post. Pre-conditions enforced:
   *  - post exists and is AWAITING_APPROVAL
   *  - approved_at is set (HITL gate)
   *  - scheduled_at has passed
   *  - retry budget has not been exhausted
   *
   * Content generation moved to ScheduledPostPrepareService; this method is
   * now purely a publication step.
   */
  async executeScheduledPost(scheduledPostId: string): Promise<void> {
    const scheduledPost = await this.scheduledPostRepository.findById(scheduledPostId);

    if (!scheduledPost) {
      logger.error(`Scheduled post not found: ${scheduledPostId}`, {}, "PostSchedulerService");
      return;
    }

    if (
      scheduledPost.status === ScheduledPostStatus.PUBLISHED ||
      scheduledPost.status === ScheduledPostStatus.CANCELLED
    ) {
      return;
    }

    // HITL gate: never publish without explicit human approval, even past
    // scheduled_at.
    if (!scheduledPost.approved_at) {
      logger.warn(
        "Skipping unapproved scheduled post",
        { scheduledPostId, status: scheduledPost.status },
        "PostSchedulerService"
      );
      return;
    }

    const now = new Date();
    if (scheduledPost.scheduled_at > now) {
      return;
    }

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
      await this.scheduledPostRepository.incrementAttempts(scheduledPostId);

      const blogId = scheduledPost.blog_id;
      if (!blogId) {
        throw new Error(
          "Approved scheduled post is missing blog_id; prepare phase did not set it."
        );
      }
      const blog = await this.blogRepository.findById(blogId, scheduledPost.site_id);
      if (!blog) {
        throw new NotFoundError(
          `Blog ${blogId} not found for scheduled post ${scheduledPostId}`
        );
      }

      if (blog.status !== BlogStatus.PUBLISHED) {
        await this.blogService.publishBlog(blogId, scheduledPost.site_id, scheduledPost.user_id);
        logger.info(
          `Published blog ${blogId} for scheduled post ${scheduledPostId}`,
          {},
          "PostSchedulerService"
        );
      }

      await this.scheduledPostRepository.markAsPublished(scheduledPostId, new Date());

      if (scheduledPost.campaign_id) {
        await this.campaignRepository.updatePostsPublished(scheduledPost.campaign_id, 1);

        const campaign = await this.campaignRepository.findById(
          scheduledPost.campaign_id,
          scheduledPost.site_id
        );
        if (campaign && campaign.end_date <= now && campaign.status === CampaignStatus.ACTIVE) {
          await this.campaignRepository.update(scheduledPost.campaign_id, scheduledPost.site_id, {
            status: CampaignStatus.COMPLETED,
          });
          logger.info(
            `Campaign ${scheduledPost.campaign_id} marked as completed`,
            {},
            "PostSchedulerService"
          );
        }
      }

      logger.info(
        `Successfully executed scheduled post ${scheduledPostId}`,
        { blogId },
        "PostSchedulerService"
      );
    } catch (error) {
      logger.error(
        `Failed to execute scheduled post ${scheduledPostId}`,
        error as Error,
        { attempts: scheduledPost.publish_attempts + 1 },
        "PostSchedulerService"
      );

      if (scheduledPost.publish_attempts + 1 >= this.MAX_RETRY_ATTEMPTS) {
        await this.scheduledPostRepository.markAsFailed(
          scheduledPostId,
          (error as Error).message || "Unknown error"
        );
      } else {
        await this.scheduledPostRepository.update(scheduledPostId, scheduledPost.site_id, {
          error_message: (error as Error).message || "Unknown error",
        });
      }
    }
  }

  /**
   * Manually trigger both phases. Useful for tests / admin endpoints.
   */
  async triggerProcessing(): Promise<void> {
    logger.info("Manually triggering scheduled post processing", {}, "PostSchedulerService");
    await this.runPreparePhase();
    await this.processScheduledPosts();
  }
}
