import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import {
  EMAIL_TEMPLATE_KEYS,
  NotificationChannel,
  NotificationType,
} from "../../../shared/constants/notification.constant";
import { ScheduledPostRepository } from "../../campaign/repositories/scheduled-post.repository";
import { ScheduledPostReviewTokenRepository } from "../repositories/scheduled-post-review-token.repository";
import { NotificationService } from "../../notification/services/notification.service";
import { UserRepository } from "../../auth/repositories/user.repository";
import { SiteRepository } from "../../site/repositories/site.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import type { ScheduledPost } from "../../../shared/schemas/scheduled-post.schema";

interface DigestPostEntry {
  post: ScheduledPost;
  reviewUrl: string;
  blogTitle: string;
}

/**
 * Weekly roll-up of pending pre-publish approvals.
 *
 * On its cron tick (`env.orchestrator.weeklyDigestCron`, default Monday 09:00)
 * the service picks every scheduled post that is AWAITING_APPROVAL and is due
 * to publish within the next 7 days, groups them by (recipient user, site),
 * issues a fresh review token per post, renders an HTML+text list, and sends
 * one digest email per (user, site) pair.
 *
 * A fresh token is minted rather than reusing the original because the raw
 * value cannot be recovered from the DB once issued. Older tokens remain
 * valid until used or expired; whichever click lands first wins.
 *
 * Email send failures are isolated per recipient so one bad mailbox doesn't
 * block the rest of the digest run.
 */
@injectable()
export class WeeklyDigestService {
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly reviewTokenRepository: ScheduledPostReviewTokenRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly siteRepository: SiteRepository,
    private readonly blogRepository: BlogRepository
  ) {}

  start(): void {
    if (this.cronJob) {
      logger.warn("Weekly digest cron already running", {}, "WeeklyDigestService");
      return;
    }
    const expression = env.orchestrator.weeklyDigestCron;
    if (!cron.validate(expression)) {
      logger.error(
        "Invalid weekly digest cron expression; service NOT started",
        new Error(`bad cron: ${expression}`),
        { expression },
        "WeeklyDigestService"
      );
      return;
    }
    this.cronJob = cron.schedule(expression, () => {
      this.runOnce().catch((err) =>
        logger.error(
          "Weekly digest run failed",
          err as Error,
          {},
          "WeeklyDigestService"
        )
      );
    });
    logger.info(
      `Weekly digest scheduled (${expression})`,
      {},
      "WeeklyDigestService"
    );
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Weekly digest stopped", {}, "WeeklyDigestService");
    }
  }

  /**
   * Trigger the digest immediately (manual / admin / tests). Safe to call
   * outside the cron loop; reuses the same windowing and grouping logic.
   */
  async runOnce(): Promise<{ recipients: number; postsConsidered: number }> {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);

    const pending = await this.scheduledPostRepository.findPendingApprovalsInWindow(
      from,
      to,
      500
    );
    if (pending.length === 0) {
      logger.info(
        "Weekly digest: no pending approvals in the next 7 days",
        {},
        "WeeklyDigestService"
      );
      return { recipients: 0, postsConsidered: 0 };
    }

    const groups = this.groupByRecipient(pending);
    let dispatched = 0;
    for (const group of groups.values()) {
      try {
        await this.sendDigestForGroup(group.userId, group.siteId, group.posts, to);
        dispatched++;
      } catch (e) {
        logger.error(
          "Weekly digest delivery failed for recipient",
          e as Error,
          { userId: group.userId, siteId: group.siteId, postCount: group.posts.length },
          "WeeklyDigestService"
        );
      }
    }
    logger.info(
      "Weekly digest run complete",
      { recipients: dispatched, postsConsidered: pending.length },
      "WeeklyDigestService"
    );
    return { recipients: dispatched, postsConsidered: pending.length };
  }

  private groupByRecipient(
    posts: ScheduledPost[]
  ): Map<string, { userId: string; siteId: string; posts: ScheduledPost[] }> {
    const out = new Map<
      string,
      { userId: string; siteId: string; posts: ScheduledPost[] }
    >();
    for (const p of posts) {
      const key = `${p.user_id}::${p.site_id}`;
      const bucket =
        out.get(key) ??
        ({ userId: p.user_id, siteId: p.site_id, posts: [] as ScheduledPost[] });
      bucket.posts.push(p);
      out.set(key, bucket);
    }
    return out;
  }

  private async sendDigestForGroup(
    userId: string,
    siteId: string,
    posts: ScheduledPost[],
    weekEnd: Date
  ): Promise<void> {
    const [user, site] = await Promise.all([
      this.userRepository.findById(userId),
      this.siteRepository.findById(siteId),
    ]);
    if (!user?.email) {
      logger.warn(
        "Weekly digest skipped: user has no email",
        { userId, siteId },
        "WeeklyDigestService"
      );
      return;
    }

    const entries = await this.buildEntries(siteId, userId, posts);
    if (entries.length === 0) {
      // All posts failed to mint a token or had no blog row; nothing to send.
      return;
    }

    const postsHtml = this.renderPostsHtml(entries);
    const postsText = this.renderPostsText(entries);
    const weekOfLabel = `the week of ${weekEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })}`;

    await this.notificationService.createAndSend({
      channel: NotificationChannel.EMAIL,
      type: NotificationType.WEEKLY_REVIEW_DIGEST,
      recipientEmail: user.email,
      templateKey: EMAIL_TEMPLATE_KEYS.WEEKLY_REVIEW_DIGEST,
      templateParams: {
        firstName: user.first_name || user.email.split("@")[0] || "there",
        siteName: site?.name || "your workspace",
        weekOfLabel,
        postCount: String(entries.length),
        postsHtml,
        postsText,
      },
      payload: {
        site_id: siteId,
        post_ids: entries.map((e) => e.post._id?.toString()).filter(Boolean),
      },
    });
  }

  private async buildEntries(
    siteId: string,
    userId: string,
    posts: ScheduledPost[]
  ): Promise<DigestPostEntry[]> {
    const ttlMs = env.orchestrator.reviewTokenTtlDays * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const base = env.frontend.baseUrl.replace(/\/$/, "");

    const entries: DigestPostEntry[] = [];
    for (const post of posts) {
      try {
        const { raw } = await this.reviewTokenRepository.issue({
          site_id: siteId,
          scheduled_post_id: post._id!.toString(),
          user_id: userId,
          rework_round: post.rework_round,
          expires_at: expiresAt,
        });
        const reviewUrl = `${base}/review/${raw}`;
        let blogTitle = post.title || "Scheduled post";
        if (post.blog_id) {
          const blog = await this.blogRepository.findById(post.blog_id, siteId);
          if (blog?.title) blogTitle = blog.title;
        }
        entries.push({ post, reviewUrl, blogTitle });
      } catch (e) {
        logger.warn(
          "Weekly digest: failed to issue token for post",
          {
            postId: post._id?.toString(),
            siteId,
            error: e instanceof Error ? e.message : String(e),
          },
          "WeeklyDigestService"
        );
      }
    }
    return entries;
  }

  private renderPostsHtml(entries: DigestPostEntry[]): string {
    const items = entries
      .map((e) => {
        const when = e.post.scheduled_at.toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        });
        return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
            <div style="font-size: 16px; font-weight: 600; color: #111827;">${escapeHtml(e.blogTitle)}</div>
            <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Scheduled for ${escapeHtml(when)}</div>
            <div style="margin-top: 8px;">
              <a href="${escapeHtml(e.reviewUrl)}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">Review</a>
            </div>
          </td>
        </tr>`;
      })
      .join("");
    return `<table style="width: 100%; border-collapse: collapse;">${items}</table>`;
  }

  private renderPostsText(entries: DigestPostEntry[]): string {
    return entries
      .map((e) => {
        const when = e.post.scheduled_at.toISOString();
        return `- "${e.blogTitle}" (scheduled ${when})\n  Review: ${e.reviewUrl}`;
      })
      .join("\n");
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
