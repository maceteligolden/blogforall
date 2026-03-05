import { injectable } from "tsyringe";
import { NotificationRepository } from "../repositories/notification.repository";
import { emailQueue } from "../queue/email.queue";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  EMAIL_TEMPLATE_KEYS,
} from "../../../shared/constants/notification.constant";
import { generateNotificationId, generateCorrelationId } from "../../../shared/utils/notification.util";
import type { Notification } from "../../../shared/schemas/notification.schema";

export interface CreateAndSendInput {
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

@injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  async createAndSend(input: CreateAndSendInput): Promise<{ notificationId: string; correlationId: string }> {
    const correlationId = input.correlationId ?? generateCorrelationId();

    if (input.channel === NotificationChannel.EMAIL) {
      const email = input.recipientEmail;
      if (!email) {
        throw new Error("recipientEmail required for email channel");
      }
      const templateKey = input.templateKey ?? this.getDefaultTemplateKeyForType(input.type);
      const record: Partial<Notification> = {
        channel: NotificationChannel.EMAIL,
        type: input.type,
        recipient_email: email,
        payload: input.payload ?? {},
        status: NotificationStatus.PENDING,
        correlation_id: correlationId,
        template_key: templateKey,
      };
      const saved = await this.notificationRepository.save(record as Notification);
      const notificationId = String(saved._id);
      await emailQueue.add({
        notificationId,
        templateKey,
        recipientEmail: email,
        correlationId,
        params: input.templateParams ?? {},
      });
      return { notificationId, correlationId };
    }

    if (input.channel === NotificationChannel.IN_APP) {
      const userId = input.recipientUserId;
      if (!userId) {
        throw new Error("recipientUserId required for in_app channel");
      }
      const record: Partial<Notification> = {
        channel: NotificationChannel.IN_APP,
        type: input.type,
        recipient_user_id: userId,
        payload: input.payload ?? {},
        status: NotificationStatus.CREATED,
        correlation_id: correlationId,
        title: input.title,
        body: input.body,
      };
      const saved = await this.notificationRepository.save(record as Notification);
      const notificationId = String(saved._id);
      return { notificationId, correlationId };
    }

    throw new Error(`Unsupported channel: ${input.channel}`);
  }

  private getDefaultTemplateKeyForType(type: string): string {
    switch (type) {
      case NotificationType.SITE_INVITATION:
        return EMAIL_TEMPLATE_KEYS.SITE_INVITATION;
      case NotificationType.PASSWORD_RESET:
        return EMAIL_TEMPLATE_KEYS.PASSWORD_RESET;
      case NotificationType.COMMENT_ON_POST:
        return EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST;
      default:
        return "site_invitation";
    }
  }

  async listByUserId(
    userId: string,
    options: { page?: number; limit?: number; since?: Date }
  ): Promise<{ data: Notification[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    return this.notificationRepository.findByUserId(userId, options);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnreadByUserId(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    return this.notificationRepository.markRead(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<number> {
    return this.notificationRepository.markAllRead(userId);
  }
}
