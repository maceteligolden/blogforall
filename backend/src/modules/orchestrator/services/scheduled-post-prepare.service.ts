import { injectable } from "tsyringe";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { BlogStatus } from "../../../shared/constants";
import {
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
} from "../../../shared/schemas/orchestrator-approval.schema";
import type { ScheduledPost } from "../../../shared/schemas/scheduled-post.schema";
import { ScheduledPostRepository } from "../../campaign/repositories/scheduled-post.repository";
import { BlogService } from "../../blog/services/blog.service";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { BlogGenerationService } from "../../blog/services/blog-generation.service";
import { WorkspaceMemoryRepository } from "../repositories/workspace-memory.repository";
import { OrchestratorApprovalRepository } from "../repositories/orchestrator-approval.repository";
import { ScheduledPostReviewTokenRepository } from "../repositories/scheduled-post-review-token.repository";

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
    private readonly reviewTokenRepository: ScheduledPostReviewTokenRepository
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

      // The raw token is intentionally returned for the email job to consume.
      // We do NOT log it. Phase 7's WeeklyDigestService will read it from the
      // emit hook (or refetch via the review token repo).
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
   * Materialize the draft this scheduled post will publish. When `blog_id`
   * is already set we just sanity-check it exists; when `auto_generate`
   * is true we call the existing BlogGenerationService and create a draft.
   */
  private async ensureBlogDraft(post: ScheduledPost): Promise<string> {
    if (post.blog_id) {
      const existing = await this.blogRepository.findById(post.blog_id, post.site_id);
      if (!existing) {
        throw new Error(`Blog ${post.blog_id} not found for scheduled post ${post._id}`);
      }
      return post.blog_id;
    }

    if (!post.auto_generate || !post.generation_prompt) {
      throw new Error(
        "Scheduled post has no blog_id and no auto_generate prompt; cannot prepare draft."
      );
    }

    const memory = await this.workspaceMemoryRepository.findBySiteId(post.site_id);
    const generationParams = {
      tone: memory?.preferences?.tone,
      targetAudience: memory?.strategic?.target_audience?.[0],
      desiredWordCount: memory?.preferences?.default_word_count,
    };
    const analysis = await this.blogGenerationService.analyzePrompt(
      post.generation_prompt,
      generationParams
    );
    if (!analysis.is_valid) {
      throw new Error(
        `Generation prompt was rejected: ${analysis.rejection_reason ?? "unknown reason"}`
      );
    }
    const generated = await this.blogGenerationService.generateBlogContent(
      post.generation_prompt,
      analysis,
      generationParams
    );

    const blog = await this.blogService.createBlog(post.user_id, post.site_id, {
      title: post.title || generated.title,
      content: generated.content,
      excerpt: generated.excerpt,
      // Prepared content stays as a draft until the reviewer approves.
      status: BlogStatus.DRAFT,
    });
    return blog._id!.toString();
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
