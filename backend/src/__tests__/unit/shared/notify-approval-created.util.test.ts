import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";
import { OrchestratorApprovalKind } from "../../../shared/schemas/orchestrator-approval.schema";
import type { OrchestratorApproval } from "../../../shared/schemas/orchestrator-approval.schema";
import { notifyApprovalCreatedInApp } from "../../../shared/utils/notify-approval-created.util";
import type { NotificationService } from "../../../modules/notification/services/notification.service";

function makeApproval(overrides: Partial<OrchestratorApproval> = {}): OrchestratorApproval {
  return {
    _id: "approval-1",
    site_id: "site-1",
    thread_id: "thread-1",
    requested_for_user_id: "user-1",
    requested_by_user_id: "user-1",
    kind: OrchestratorApprovalKind.IN_CHAT_CONFIRMATION,
    action: "blogs.delete",
    summary: "Delete this blog?",
    payload: {},
    status: "pending" as OrchestratorApproval["status"],
    requested_at: new Date(),
    ...overrides,
  } as OrchestratorApproval;
}

describe("notifyApprovalCreatedInApp", () => {
  it("creates IN_APP confirmation_needed for in-chat approvals", async () => {
    const createAndSend = jest.fn().mockResolvedValue({ notificationId: "n1", correlationId: "c1" });
    const notificationService = { createAndSend } as unknown as NotificationService;

    await notifyApprovalCreatedInApp(notificationService, makeApproval());

    expect(createAndSend).toHaveBeenCalledTimes(1);
    expect(createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.CONFIRMATION_NEEDED,
        recipientUserId: "user-1",
        title: "Confirmation needed",
        body: "Delete this blog?",
        payload: expect.objectContaining({
          approval_id: "approval-1",
          site_id: "site-1",
          thread_id: "thread-1",
          action: "blogs.delete",
        }),
      })
    );
  });

  it("creates IN_APP scheduled_post_review for schedule reviews", async () => {
    const createAndSend = jest.fn().mockResolvedValue({ notificationId: "n1", correlationId: "c1" });
    const notificationService = { createAndSend } as unknown as NotificationService;

    await notifyApprovalCreatedInApp(
      notificationService,
      makeApproval({
        kind: OrchestratorApprovalKind.SCHEDULED_POST_REVIEW,
        summary: 'Review "Post" scheduled for …',
        thread_id: undefined,
        payload: { blog_id: "blog-1", scheduled_post_id: "sp-1", rework_round: 0 },
      })
    );

    expect(createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.SCHEDULED_POST_REVIEW,
        title: "Scheduled post needs review",
        payload: expect.objectContaining({
          blog_id: "blog-1",
          scheduled_post_id: "sp-1",
        }),
      })
    );
  });

  it("uses scheduled_post_reworked when rework_round > 0", async () => {
    const createAndSend = jest.fn().mockResolvedValue({ notificationId: "n1", correlationId: "c1" });
    const notificationService = { createAndSend } as unknown as NotificationService;

    await notifyApprovalCreatedInApp(
      notificationService,
      makeApproval({
        kind: OrchestratorApprovalKind.SCHEDULED_POST_REVIEW,
        payload: { rework_round: 2 },
      })
    );

    expect(createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.SCHEDULED_POST_REWORKED,
        title: "Rework ready for review",
      })
    );
  });

  it("does not throw when createAndSend fails", async () => {
    const createAndSend = jest.fn().mockRejectedValue(new Error("db down"));
    const notificationService = { createAndSend } as unknown as NotificationService;

    await expect(notifyApprovalCreatedInApp(notificationService, makeApproval())).resolves.toBeUndefined();
  });

  it("skips when recipient user id is missing", async () => {
    const createAndSend = jest.fn();
    const notificationService = { createAndSend } as unknown as NotificationService;

    await notifyApprovalCreatedInApp(notificationService, makeApproval({ requested_for_user_id: "" }));

    expect(createAndSend).not.toHaveBeenCalled();
  });
});
