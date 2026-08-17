import type { NotificationItem } from "@/lib/api/types/notification.types";

type NotificationPayload = {
  blogId?: string;
  blog_id?: string;
  token?: string;
  approval_id?: string;
  site_id?: string;
  campaign_id?: string;
  campaignId?: string;
};

/**
 * Resolve where a notification click should navigate.
 * Returns null when there is no deep link (caller still marks read).
 */
export function getNotificationHref(notification: NotificationItem): string | null {
  const payload = (notification.payload ?? {}) as NotificationPayload;
  const type = notification.type;
  const blogId = payload.blogId ?? payload.blog_id;
  const campaignId = payload.campaign_id ?? payload.campaignId;

  if (type === "content_strategy_ready") {
    return "/dashboard";
  }

  if (type === "blog_draft_ready" && blogId) {
    return `/dashboard/posts/${blogId}`;
  }

  if (type === "site_invitation" && typeof payload.token === "string" && payload.token) {
    return `/invitations/accept?token=${encodeURIComponent(payload.token)}`;
  }

  if ((type === "scheduled_post_review" || type === "scheduled_post_reworked") && campaignId && blogId) {
    return `/dashboard/posts/${blogId}`;
  }

  if (
    type === "confirmation_needed" ||
    type === "scheduled_post_review" ||
    type === "scheduled_post_reworked" ||
    type === "weekly_review_digest" ||
    typeof payload.approval_id === "string"
  ) {
    return "/dashboard/approvals";
  }

  if (blogId) {
    return `/dashboard/posts/${blogId}/view`;
  }

  return null;
}
