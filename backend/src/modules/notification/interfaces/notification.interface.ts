import type { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";

/** Input to create and send a notification (email or in-app). */
export interface CreateNotificationInput {
  type: NotificationType | string;
  channel: NotificationChannel;
  recipientUserId?: string;
  recipientEmail?: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
  idempotencyKey?: string;
  templateKey?: string;
  templateParams?: Record<string, string>;
  title?: string;
  body?: string;
}

/** Result of createAndSend. */
export interface CreateNotificationResult {
  notificationId: string;
  correlationId: string;
}

/** Options for listing notifications by user. */
export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  since?: Date;
}

/** Paginated list result. */
export interface ListNotificationsResult {
  data: unknown[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
