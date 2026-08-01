import { WeeklyDigestService } from "../../../../modules/orchestrator/services/weekly-digest.service";
import { NotificationChannel, NotificationType } from "../../../../shared/constants/notification.constant";

describe("WeeklyDigestService IN_APP twin", () => {
  it("creates EMAIL and IN_APP notifications for a digest recipient", async () => {
    const createAndSend = jest.fn().mockResolvedValue({ notificationId: "n1", correlationId: "c1" });
    const findPendingApprovalsInWindow = jest.fn().mockResolvedValue([
      {
        _id: "sp-1",
        user_id: "user-1",
        site_id: "site-1",
        blog_id: "blog-1",
        title: "Hello",
        scheduled_at: new Date(Date.now() + 86_400_000),
      },
    ]);
    const issue = jest.fn().mockResolvedValue({ raw: "raw-token", token: { _id: "tok-1" } });
    const findByIdUser = jest.fn().mockResolvedValue({
      _id: "user-1",
      email: "u@example.com",
      first_name: "Ada",
    });
    const findByIdSite = jest.fn().mockResolvedValue({ _id: "site-1", name: "Acme" });
    const findByIdBlog = jest.fn().mockResolvedValue({ _id: "blog-1", title: "Hello", excerpt: "…" });

    const service = new WeeklyDigestService(
      { findPendingApprovalsInWindow } as never,
      { issue } as never,
      { createAndSend } as never,
      { findById: findByIdUser } as never,
      { findById: findByIdSite } as never,
      { findById: findByIdBlog } as never
    );

    const result = await service.runOnce();

    expect(result.recipients).toBe(1);
    expect(createAndSend).toHaveBeenCalledTimes(2);
    expect(createAndSend.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        type: NotificationType.WEEKLY_REVIEW_DIGEST,
        recipientEmail: "u@example.com",
      })
    );
    expect(createAndSend.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.WEEKLY_REVIEW_DIGEST,
        recipientUserId: "user-1",
        title: "Weekly review digest",
        payload: expect.objectContaining({ site_id: "site-1", post_count: 1 }),
      })
    );
  });
});
