import { NotificationChannel, NotificationType } from "../constants/notification.constant";
import { OrchestratorApprovalKind, type OrchestratorApproval } from "../schemas/orchestrator-approval.schema";
import type { NotificationService } from "../../modules/notification/services/notification.service";
import { logger } from "./logger";

/**
 * Persist an IN_APP notification for a new approval so the bell updates via
 * notification.created. Failures are logged and never thrown.
 */
export async function notifyApprovalCreatedInApp(
  notificationService: NotificationService,
  approval: OrchestratorApproval
): Promise<void> {
  const userId = approval.requested_for_user_id;
  if (!userId) return;

  const approvalId = approval._id?.toString();
  if (!approvalId) return;

  if (approval.kind === OrchestratorApprovalKind.IN_CHAT_CONFIRMATION) {
    return;
  }

  const reworkRound =
    typeof approval.payload?.rework_round === "number"
      ? approval.payload.rework_round
      : Number(approval.payload?.rework_round ?? 0);

  const isScheduleReview = approval.kind === OrchestratorApprovalKind.SCHEDULED_POST_REVIEW;
  const campaignId =
    typeof approval.payload?.campaign_id === "string" ? approval.payload.campaign_id : undefined;
  const isCampaignDraft = isScheduleReview && Boolean(campaignId);
  const type = isScheduleReview
    ? reworkRound > 0
      ? NotificationType.SCHEDULED_POST_REWORKED
      : NotificationType.SCHEDULED_POST_REVIEW
    : NotificationType.CONFIRMATION_NEEDED;

  const title = isScheduleReview
    ? reworkRound > 0
      ? "Rework ready for review"
      : isCampaignDraft
        ? "Draft ready — review and schedule"
        : "Scheduled post needs review"
    : "Confirmation needed";

  const body =
    isCampaignDraft && reworkRound === 0
      ? "Your campaign draft is ready. Review the post, then confirm timing on the campaign Schedule tab."
      : approval.summary;

  try {
    await notificationService.createAndSend({
      channel: NotificationChannel.IN_APP,
      type,
      recipientUserId: userId,
      title,
      body,
      payload: {
        approval_id: approvalId,
        site_id: approval.site_id,
        thread_id: approval.thread_id,
        action: approval.action,
        kind: approval.kind,
        ...(typeof approval.payload?.blog_id === "string" ? { blog_id: approval.payload.blog_id } : {}),
        ...(typeof approval.payload?.scheduled_post_id === "string"
          ? { scheduled_post_id: approval.payload.scheduled_post_id }
          : {}),
        ...(campaignId ? { campaign_id: campaignId } : {}),
      },
    });
  } catch (error) {
    logger.error(
      "Failed to create in-app notification for approval",
      error instanceof Error ? error : new Error(String(error)),
      { approvalId, userId, siteId: approval.site_id },
      "notifyApprovalCreatedInApp"
    );
  }
}
