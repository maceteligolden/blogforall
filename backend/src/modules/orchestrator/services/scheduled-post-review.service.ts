import { injectable } from "tsyringe";
import { env } from "../../../shared/config/env";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";
import {
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
} from "../../../shared/schemas/orchestrator-approval.schema";
import { ReviewTokenAction } from "../../../shared/schemas/scheduled-post-review-token.schema";
import { ScheduledPostRepository } from "../../campaign/repositories/scheduled-post.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { ScheduledPostReviewTokenRepository } from "../repositories/scheduled-post-review-token.repository";
import { OrchestratorApprovalRepository } from "../repositories/orchestrator-approval.repository";
import { ScheduledPostPrepareService } from "./scheduled-post-prepare.service";

export interface ReviewContext {
  scheduled_post: {
    id: string;
    site_id: string;
    title: string;
    scheduled_at: Date;
    timezone: string;
    status: ScheduledPostStatus;
    rework_round: number;
    rework_comments?: string;
    prepared_at?: Date;
    approved_at?: Date;
  };
  blog: {
    id: string;
    title: string;
    excerpt?: string;
    content: string;
    status: string;
  } | null;
  token: {
    expires_at: Date;
    rework_round: number;
  };
}

export interface ReviewDecisionResult {
  status: "approved" | "rework_requested";
  scheduled_post_id: string;
  rework_round: number;
  message: string;
}

/**
 * Unauthenticated review service for scheduled posts. Drives the email-link
 * flow: a workspace owner receives a review token, opens the preview page,
 * and chooses Approve or Request Rework. Every method validates the token
 * before doing anything; the JWT auth middleware is intentionally not used.
 */
@injectable()
export class ScheduledPostReviewService {
  constructor(
    private readonly tokenRepository: ScheduledPostReviewTokenRepository,
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly blogRepository: BlogRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly prepareService: ScheduledPostPrepareService
  ) {}

  /**
   * Load the read-only context the preview page renders. Does NOT consume
   * the token; the user is free to revisit until they make a decision.
   */
  async getReviewContext(rawToken: string): Promise<ReviewContext> {
    const { token, post, blog } = await this.resolveTokenAndPost(rawToken);

    return {
      scheduled_post: {
        id: post._id!.toString(),
        site_id: post.site_id,
        title: post.title,
        scheduled_at: post.scheduled_at,
        timezone: post.timezone,
        status: post.status,
        rework_round: post.rework_round,
        rework_comments: post.rework_comments,
        prepared_at: post.prepared_at,
        approved_at: post.approved_at,
      },
      blog: blog
        ? {
            id: blog._id!.toString(),
            title: blog.title,
            excerpt: blog.excerpt,
            content: blog.content,
            status: blog.status,
          }
        : null,
      token: {
        expires_at: token.expires_at,
        rework_round: token.rework_round,
      },
    };
  }

  /**
   * Reviewer approved the draft. Atomically:
   *  - mark the scheduled post approved (publish phase will pick it up)
   *  - consume the token (single-use)
   *  - resolve the linked OrchestratorApproval as approved + executed
   */
  async approve(rawToken: string): Promise<ReviewDecisionResult> {
    const { token, post } = await this.resolveTokenAndPost(rawToken);
    if (post.status !== ScheduledPostStatus.AWAITING_APPROVAL) {
      throw new BadRequestError(
        `Scheduled post is no longer awaiting approval (status: ${post.status}).`
      );
    }

    const consumed = await this.tokenRepository.consume(
      token._id!.toString(),
      ReviewTokenAction.APPROVED
    );
    if (!consumed) {
      throw new BadRequestError("This review link has already been used.");
    }

    const approved = await this.scheduledPostRepository.markApproved(
      post._id!.toString(),
      post.site_id,
      token.user_id
    );
    if (!approved) {
      // Either the post moved out of AWAITING_APPROVAL between our checks
      // (rework, cancel) or another reviewer beat us. Surface a clear error
      // so the page can refetch context.
      throw new BadRequestError("Scheduled post is no longer awaiting approval.");
    }

    await this.resolveOrchestratorApproval(
      approved._id!.toString(),
      approved.site_id,
      OrchestratorApprovalStatus.APPROVED,
      token.user_id,
      "Approved via review link"
    );

    logger.info(
      "Scheduled post approved via review link",
      {
        scheduledPostId: approved._id?.toString(),
        siteId: approved.site_id,
        reworkRound: approved.rework_round,
      },
      "ScheduledPostReviewService"
    );

    return {
      status: "approved",
      scheduled_post_id: approved._id!.toString(),
      rework_round: approved.rework_round,
      message: "Thanks! The post is approved and will publish at its scheduled time.",
    };
  }

  /**
   * Reviewer requested rework. Atomically:
   *  - mark the scheduled post REWORK_REQUESTED (clears approved_at, bumps round)
   *  - consume this token
   *  - invalidate any other outstanding tokens for the post (defensive)
   *  - resolve the linked OrchestratorApproval as rejected with the note
   *  - re-trigger preparation so a fresh draft will be issued + new token sent
   */
  async requestRework(rawToken: string, comments: string): Promise<ReviewDecisionResult> {
    const trimmed = (comments || "").trim();
    if (!trimmed) {
      throw new BadRequestError("Rework comments are required.");
    }
    if (trimmed.length > 4000) {
      throw new BadRequestError("Rework comments must be 4000 characters or fewer.");
    }

    const { token, post } = await this.resolveTokenAndPost(rawToken);
    if (post.status !== ScheduledPostStatus.AWAITING_APPROVAL) {
      throw new BadRequestError(
        `Scheduled post is no longer awaiting approval (status: ${post.status}).`
      );
    }
    if (post.rework_round >= env.orchestrator.maxReworkRounds) {
      throw new BadRequestError(
        `Maximum rework rounds (${env.orchestrator.maxReworkRounds}) reached. Please edit the draft manually instead.`
      );
    }

    const consumed = await this.tokenRepository.consume(
      token._id!.toString(),
      ReviewTokenAction.REWORK_REQUESTED
    );
    if (!consumed) {
      throw new BadRequestError("This review link has already been used.");
    }

    const reworked = await this.scheduledPostRepository.markReworkRequested(
      post._id!.toString(),
      post.site_id,
      trimmed,
      token.user_id
    );
    if (!reworked) {
      throw new BadRequestError("Scheduled post is no longer awaiting approval.");
    }

    // Defensive: invalidate any sibling tokens. A normal flow only has one,
    // but partial failures elsewhere could leave a stale token alive.
    await this.tokenRepository.invalidateForScheduledPost(reworked.site_id, reworked._id!.toString());

    await this.resolveOrchestratorApproval(
      reworked._id!.toString(),
      reworked.site_id,
      OrchestratorApprovalStatus.REJECTED,
      token.user_id,
      trimmed
    );

    // Kick off a fresh prepare immediately so the user gets a new email
    // with the regenerated draft without waiting for the next cron tick.
    // Failures here are non-fatal — the cron pass will retry.
    try {
      await this.prepareService.rerunForRework(reworked._id!.toString(), reworked.site_id);
    } catch (e) {
      logger.warn(
        "Immediate rework rerun failed; cron will retry",
        { scheduledPostId: reworked._id?.toString(), error: (e as Error).message },
        "ScheduledPostReviewService"
      );
    }

    logger.info(
      "Scheduled post rework requested via review link",
      {
        scheduledPostId: reworked._id?.toString(),
        siteId: reworked.site_id,
        newReworkRound: reworked.rework_round,
      },
      "ScheduledPostReviewService"
    );

    return {
      status: "rework_requested",
      scheduled_post_id: reworked._id!.toString(),
      rework_round: reworked.rework_round,
      message:
        "Thanks — your feedback was sent to the orchestrator. We'll email you a new draft to review.",
    };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Resolve a raw token to its row + the linked scheduled post + blog,
   * applying the security checks shared by every entry point: the token
   * must be valid (unused, unexpired), and its rework_round must still
   * match the post (so reused links from prior rounds don't decide a
   * fresher draft).
   */
  private async resolveTokenAndPost(rawToken: string) {
    if (!rawToken || rawToken.length < 8) {
      throw new BadRequestError("Invalid review link.");
    }
    const token = await this.tokenRepository.findValid(rawToken);
    if (!token) {
      throw new NotFoundError("Review link is invalid, expired, or already used.");
    }
    const post = await this.scheduledPostRepository.findById(
      token.scheduled_post_id,
      token.site_id
    );
    if (!post) {
      throw new NotFoundError("Scheduled post no longer exists.");
    }
    if (post.user_id !== token.user_id) {
      throw new ForbiddenError("This review link does not belong to the post owner.");
    }
    if (token.rework_round !== post.rework_round) {
      throw new BadRequestError(
        "This review link is for an older draft. Please use the most recent email."
      );
    }
    const blog = post.blog_id
      ? await this.blogRepository.findById(post.blog_id, post.site_id)
      : null;
    return { token, post, blog };
  }

  /**
   * Best-effort resolution of the OrchestratorApproval that this scheduled
   * post raised during prepare. If we can't find one (e.g. it was already
   * decided in the approvals UI), we still let the token-driven decision
   * win on the scheduled post row.
   */
  private async resolveOrchestratorApproval(
    scheduledPostId: string,
    siteId: string,
    decision: OrchestratorApprovalStatus.APPROVED | OrchestratorApprovalStatus.REJECTED,
    deciderUserId: string,
    note: string
  ): Promise<void> {
    const pending = await this.approvalRepository.listPendingForSite(siteId, 500);
    const match = pending.find(
      (a) =>
        a.kind === OrchestratorApprovalKind.SCHEDULED_POST_REVIEW &&
        (a.payload as Record<string, unknown> | undefined)?.scheduled_post_id === scheduledPostId
    );
    if (!match) return;
    const decided = await this.approvalRepository.decide(
      match._id!.toString(),
      siteId,
      decision,
      deciderUserId,
      note
    );
    if (decided) {
      await this.approvalRepository.markExecuted(decided._id!.toString(), siteId, {
        ok: true,
        summary:
          decision === OrchestratorApprovalStatus.APPROVED
            ? "Reviewer approved via email link"
            : "Reviewer requested rework via email link",
      });
    }
  }
}
