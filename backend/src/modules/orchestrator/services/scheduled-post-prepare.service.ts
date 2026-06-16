import { injectable } from "tsyringe";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { BlogStatus } from "../../../shared/constants";
import {
  EMAIL_TEMPLATE_KEYS,
  NotificationChannel,
  NotificationType,
} from "../../../shared/constants/notification.constant";
import {
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
} from "../../../shared/schemas/orchestrator-approval.schema";
import type { ScheduledPost } from "../../../shared/schemas/scheduled-post.schema";
import { ScheduledPostRepository } from "../../campaign/repositories/scheduled-post.repository";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import {
  CampaignLifecycleStatus,
  CampaignStatus,
} from "../../../shared/constants/campaign.constant";
import { BlogService } from "../../blog/services/blog.service";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { BlogGenerationService } from "../../blog/services/blog-generation.service";
import { WorkspaceMemoryRepository } from "../repositories/workspace-memory.repository";
import { OrchestratorApprovalRepository } from "../repositories/orchestrator-approval.repository";
import { ScheduledPostReviewTokenRepository } from "../repositories/scheduled-post-review-token.repository";
import { NotificationService } from "../../notification/services/notification.service";
import { UserRepository } from "../../auth/repositories/user.repository";
import { SiteRepository } from "../../site/repositories/site.repository";
import { TokenEnforcementService } from "../../token-ledger/services/token-enforcement.service";
import { TokenLedgerFeature } from "../../../shared/constants/token-ledger.constant";

const PREPARE_BATCH_SIZE = 10;

interface PrepareOutcome {
  scheduledPostId: string;
  ok: boolean;
  reason?: string;
}

/**
 * Pre-publish "prepare" phase of the human-in-the-loop publishing pipeline.
 *
 * Posts in `PENDING` or `SCHEDULED` whose `scheduled_at` falls within the
 * configured review lead time are picked up here, content is materialized
 * (generated if `auto_generate`, or just confirmed if a draft already
 * exists), then atomically transitioned to `AWAITING_APPROVAL` with a
 * fresh review token + orchestrator approval row so the user can review
 * via email link or the in-app approvals page.
 *
 * The publish phase (PostSchedulerService.executeScheduledPost) only
 * publishes posts that have crossed `scheduled_at` AND have an
 * `approved_at` set, so an unreviewed draft will never auto-publish.
 */
@injectable()
export class ScheduledPostPrepareService {
  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly blogService: BlogService,
    private readonly blogRepository: BlogRepository,
    private readonly blogGenerationService: BlogGenerationService,
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly reviewTokenRepository: ScheduledPostReviewTokenRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly siteRepository: SiteRepository,
    private readonly tokenEnforcement: TokenEnforcementService,
    private readonly campaignRepository: CampaignRepository
  ) {}

  /**
   * Sweep all posts due for preparation across all workspaces and run them
   * through `prepareOne` in bounded parallel batches. Failures are isolated
   * so a single bad post never blocks the queue.
   */
  async sweep(): Promise<void> {
    const leadTimeMs = env.orchestrator.reviewLeadTimeHoursDefault * 60 * 60 * 1000;
    const dueWindowMs = Math.max(leadTimeMs, 60 * 60 * 1000);
    const candidates = await this.scheduledPostRepository.findDueForPreparation(
      dueWindowMs,
      100
    );
    if (candidates.length === 0) return;

    logger.info(
      `Preparing ${candidates.length} scheduled post(s) for review`,
      {},
      "ScheduledPostPrepareService"
    );

    for (let i = 0; i < candidates.length; i += PREPARE_BATCH_SIZE) {
      const batch = candidates.slice(i, i + PREPARE_BATCH_SIZE);
      await Promise.allSettled(
        batch.map((p) => this.prepareOne(p._id!.toString(), p.site_id))
      );
    }
  }

  /**
   * Prepare a single scheduled post: ensure a blog draft exists, transition
   * to AWAITING_APPROVAL, issue a review token, and raise an approval.
   * Returns a structured outcome (idempotent on re-run).
   */
  async prepareOne(scheduledPostId: string, siteId: string): Promise<PrepareOutcome> {
    const post = await this.scheduledPostRepository.findById(scheduledPostId, siteId);
    if (!post) {
      return { scheduledPostId, ok: false, reason: "Scheduled post not found" };
    }
    if (post.prepared_at) {
      // Already prepared; let the publish worker / reviewer take it from here.
      return { scheduledPostId, ok: true, reason: "Already prepared" };
    }

    if (post.campaign_id) {
      const campaign = await this.campaignRepository.findById(post.campaign_id, siteId);
      const paused =
        campaign?.lifecycle_status === CampaignLifecycleStatus.PAUSED ||
        campaign?.status === CampaignStatus.PAUSED;
      if (paused) {
        return { scheduledPostId, ok: false, reason: "Campaign is paused" };
      }
    }

    try {
      const blogId = await this.ensureBlogDraft(post);
      const prepared = await this.scheduledPostRepository.markPrepared(
        scheduledPostId,
        siteId,
        { blog_id: blogId }
      );
      if (!prepared) {
        // Another worker raced us. Whoever won will issue the token + approval.
        return { scheduledPostId, ok: true, reason: "Raced with another worker" };
      }

      const tokenTtlMs = env.orchestrator.reviewTokenTtlDays * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Date.now() + tokenTtlMs);
      const { token, raw } = await this.reviewTokenRepository.issue({
        site_id: siteId,
        scheduled_post_id: scheduledPostId,
        user_id: post.user_id,
        rework_round: prepared.rework_round,
        expires_at: expiresAt,
      });

      const approval = await this.approvalRepository.create({
        site_id: siteId,
        requested_for_user_id: post.user_id,
        requested_by_user_id: post.user_id,
        kind: OrchestratorApprovalKind.SCHEDULED_POST_REVIEW,
        action: "scheduled_post.review",
        summary: `Review "${post.title}" scheduled for ${prepared.scheduled_at.toISOString()}.`,
        payload: {
          scheduled_post_id: scheduledPostId,
          blog_id: blogId,
          rework_round: prepared.rework_round,
          review_token_id: token._id?.toString(),
        },
        expires_at: expiresAt,
      });

      logger.info(
        "Scheduled post prepared and awaiting approval",
        {
          scheduledPostId,
          siteId,
          approvalId: approval._id?.toString(),
          reworkRound: prepared.rework_round,
        },
        "ScheduledPostPrepareService"
      );

      // Best-effort: send the per-post review email. Email failures are
      // not fatal because the approval is already on the dashboard and
      // the weekly digest will re-surface this post anyway.
      try {
        await this.sendReviewEmailForPost({
          post: prepared,
          rawToken: raw,
          blogId,
          isRework: prepared.rework_round > 0,
        });
      } catch (emailErr) {
        logger.warn(
          "Failed to send pre-publish review email",
          {
            scheduledPostId,
            siteId,
            error: emailErr instanceof Error ? emailErr.message : String(emailErr),
          },
          "ScheduledPostPrepareService"
        );
      }

      return { scheduledPostId, ok: true, reason: raw ? "token-issued" : "ok" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(
        "Failed to prepare scheduled post",
        e as Error,
        { scheduledPostId, siteId },
        "ScheduledPostPrepareService"
      );
      await this.scheduledPostRepository.update(scheduledPostId, siteId, {
        error_message: msg,
      });
      return { scheduledPostId, ok: false, reason: msg };
    }
  }

  /**
   * Materialize the draft this scheduled post will publish.
   *
   *  - First prepare round, no existing blog: generate from scratch using
   *    auto_generate prompt + workspace memory.
   *  - Rework round (rework_comments present) on an existing blog: revise
   *    the existing draft with regenerateWithFeedback and persist the new
   *    body back to the same blog row (so the review link's blog_id is
   *    stable across rounds).
   *  - Existing blog with no rework comments: nothing to (re)generate;
   *    just sanity-check it exists.
   */
  private async ensureBlogDraft(post: ScheduledPost): Promise<string> {
    const memory = await this.workspaceMemoryRepository.findBySiteId(post.site_id);
    const generationParams = this.buildGenerationParams(memory);

    if (post.blog_id) {
      const existing = await this.blogRepository.findById(post.blog_id, post.site_id);
      if (!existing) {
        throw new Error(`Blog ${post.blog_id} not found for scheduled post ${post._id}`);
      }

      const isReworkPass = !!post.rework_comments && post.rework_round > 0;
      if (!isReworkPass) {
        return post.blog_id;
      }

      const requestId = `cron:scheduled-prepare:${post._id}:rework:${post.rework_round}`;
      return this.tokenEnforcement.runWithReservation({
        userId: post.user_id,
        siteId: post.site_id,
        feature: TokenLedgerFeature.SCHEDULED_BLOG_PREPARE,
        requestId,
        estimate: {
          feature: TokenLedgerFeature.SCHEDULED_BLOG_PREPARE,
          promptText: post.rework_comments ?? "",
          contextText: existing.content,
          wordCount: generationParams?.word_count,
        },
        fn: async () => {
          const revised = await this.blogGenerationService.regenerateWithFeedback({
            title: existing.title,
            content: existing.content,
            excerpt: existing.excerpt,
            feedback: post.rework_comments!,
            userParams: generationParams,
          });
          await this.blogRepository.update(post.blog_id!, post.site_id, {
            title: revised.title,
            content: revised.content,
            excerpt: revised.excerpt,
            status: BlogStatus.DRAFT,
          });
          logger.info(
            "Rework round regenerated blog draft",
            {
              siteId: post.site_id,
              blogId: post.blog_id,
              reworkRound: post.rework_round,
            },
            "ScheduledPostPrepareService"
          );
          return post.blog_id!;
        },
      });
    }

    if (!post.auto_generate || !post.generation_prompt) {
      throw new Error(
        "Scheduled post has no blog_id and no auto_generate prompt; cannot prepare draft."
      );
    }

    const requestId = `cron:scheduled-prepare:${post._id}:generate`;
    return this.tokenEnforcement.runWithReservation({
      userId: post.user_id,
      siteId: post.site_id,
      feature: TokenLedgerFeature.SCHEDULED_BLOG_PREPARE,
      requestId,
      estimate: {
        feature: TokenLedgerFeature.SCHEDULED_BLOG_PREPARE,
        promptText: post.generation_prompt,
        wordCount: generationParams?.word_count,
      },
      fn: async () => {
        const analysis = await this.blogGenerationService.analyzePrompt(
          post.generation_prompt!,
          generationParams
        );
        if (!analysis.is_valid) {
          throw new Error(
            `Generation prompt was rejected: ${analysis.rejection_reason ?? "unknown reason"}`
          );
        }
        const generated = await this.blogGenerationService.generateBlogContent(
          post.generation_prompt!,
          analysis,
          generationParams
        );

        const blog = await this.blogService.createBlog(post.user_id, post.site_id, {
          title: post.title || generated.title,
          content: generated.content,
          excerpt: generated.excerpt,
          status: BlogStatus.DRAFT,
        });
        return blog._id!.toString();
      },
    });
  }

  /**
   * Translate WorkspaceMemory into the generation params the blog AI accepts.
   * Centralised so both fresh-generation and rework paths share the same
   * tone / audience / word-count signal.
   */
  private buildGenerationParams(memory: Awaited<ReturnType<WorkspaceMemoryRepository["findBySiteId"]>>) {
    return {
      tone: memory?.preferences?.tone,
      target_audience: memory?.strategic?.target_audience?.[0],
      word_count: memory?.preferences?.default_word_count,
    };
  }

  /**
   * Re-run preparation after a rework decision. Caller is responsible for
   * having already incremented rework_round (via markReworkRequested) and
   * for resetting `prepared_at`, which markReworkRequested does atomically.
   */
  async rerunForRework(scheduledPostId: string, siteId: string): Promise<PrepareOutcome> {
    return this.prepareOne(scheduledPostId, siteId);
  }

  /**
   * Manually trigger a sweep (useful for tests / admin endpoints).
   */
  async triggerSweep(): Promise<void> {
    await this.sweep();
  }

  /**
   * Send the per-post review email (or rework re-review email) to the
   * workspace owner. Looks up the owner via the user repository and the
   * site via the site repository for display copy. Falls back to safe
   * defaults so a missing site name never blocks the email.
   */
  private async sendReviewEmailForPost(input: {
    post: ScheduledPost;
    rawToken: string;
    blogId: string;
    isRework: boolean;
  }): Promise<void> {
    const { post, rawToken, blogId, isRework } = input;
    const [user, site, blog] = await Promise.all([
      this.userRepository.findById(post.user_id),
      this.siteRepository.findById(post.site_id),
      this.blogRepository.findById(blogId, post.site_id),
    ]);
    if (!user?.email) {
      logger.warn(
        "Skipping review email: workspace owner has no email on file",
        { scheduledPostId: post._id?.toString(), siteId: post.site_id },
        "ScheduledPostPrepareService"
      );
      return;
    }

    const reviewUrl = `${env.frontend.baseUrl.replace(/\/$/, "")}/review/${rawToken}`;
    const scheduledFor = post.scheduled_at.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const templateKey = isRework
      ? EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REWORKED
      : EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REVIEW;
    const notificationType = isRework
      ? NotificationType.SCHEDULED_POST_REWORKED
      : NotificationType.SCHEDULED_POST_REVIEW;

    await this.notificationService.createAndSend({
      channel: NotificationChannel.EMAIL,
      type: notificationType,
      recipientEmail: user.email,
      templateKey,
      templateParams: {
        firstName: user.first_name || user.email.split("@")[0] || "there",
        siteName: site?.name || "your workspace",
        blogTitle: blog?.title || post.title || "scheduled post",
        scheduledFor,
        reviewUrl,
        excerpt: (blog?.excerpt || "").trim().slice(0, 240),
        ...(isRework ? { reworkRound: String(post.rework_round) } : {}),
      },
      payload: {
        site_id: post.site_id,
        scheduled_post_id: post._id?.toString(),
        blog_id: blogId,
        rework_round: post.rework_round,
      },
    });
  }

  /**
   * Find any open approval associated with this scheduled post so callers
   * (e.g. the review API) can atomically resolve them when the reviewer
   * acts. Centralized here to keep the lookup logic next to the writer.
   */
  async findOpenApprovalForScheduledPost(
    siteId: string,
    scheduledPostId: string
  ): Promise<string | null> {
    const approvals = await this.approvalRepository.listPendingForSite(siteId, 500);
    const match = approvals.find(
      (a) =>
        a.kind === OrchestratorApprovalKind.SCHEDULED_POST_REVIEW &&
        (a.payload as Record<string, unknown> | undefined)?.scheduled_post_id === scheduledPostId &&
        a.status === OrchestratorApprovalStatus.PENDING
    );
    return match?._id?.toString() ?? null;
  }
}
