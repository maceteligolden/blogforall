import { injectable } from "tsyringe";
import { NotificationRepository } from "../repositories/notification.repository";
import { emailQueue } from "../queue/email.queue";
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  EMAIL_TEMPLATE_KEYS,
} from "../../../shared/constants/notification.constant";
import { generateCorrelationId } from "../../../shared/utils/notification.util";
import { logger } from "../../../shared/utils/logger";
import { BadRequestError, AppError } from "../../../shared/errors";
import type { Notification } from "../../../shared/schemas/notification.schema";
import type {
  CreateNotificationInput,
  CreateNotificationResult,
  ListNotificationsOptions,
  ListNotificationsResult,
} from "../interfaces/notification.interface";

@injectable()
export class NotificationService {
  constructor(private readonly notificationRepository: NotificationRepository) {}

  /**
   * PSEUDOCODE:
   * 1. SET correlationId = input.correlationId OR generate new
   * 2. IF channel is EMAIL:
   *    a. VALIDATE recipientEmail present ELSE throw BadRequestError
   *    b. TRY: resolve templateKey, build record, SAVE to DB, ADD job to email queue, RETURN ids
   *    c. CATCH: rethrow AppError else wrap in AppError
   * 3. IF channel is IN_APP:
   *    a. VALIDATE recipientUserId present ELSE throw BadRequestError
   *    b. TRY: build record, SAVE to DB, RETURN ids
   *    c. CATCH: rethrow AppError else wrap in AppError
   * 4. ELSE throw BadRequestError (unsupported channel)
   */
  async createAndSend(input: CreateNotificationInput): Promise<CreateNotificationResult> {
    const correlationId = input.correlationId ?? generateCorrelationId();

    if (input.channel === NotificationChannel.EMAIL) {
      const email = input.recipientEmail;
      if (!email) {
        throw new BadRequestError("recipientEmail required for email channel");
      }
      try {
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
        logger.info(
          "Email notification enqueued",
          { notificationId, templateKey, correlationId },
          "NotificationService"
        );
        return { notificationId, correlationId };
      } catch (error: unknown) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          error instanceof Error ? error.message : "Failed to create or enqueue email notification"
        );
      }
    }

    if (input.channel === NotificationChannel.IN_APP) {
      const userId = input.recipientUserId;
      if (!userId) {
        throw new BadRequestError("recipientUserId required for in_app channel");
      }
      try {
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
      } catch (error: unknown) {
        if (error instanceof AppError) throw error;
        throw new AppError(
          error instanceof Error ? error.message : "Failed to create in-app notification"
        );
      }
    }

    throw new BadRequestError(`Unsupported channel: ${input.channel}`);
  }

  /**
   * PSEUDOCODE:
   * 1. SWITCH type: MAP SITE_INVITATION -> site_invitation, PASSWORD_RESET -> password_reset, COMMENT_ON_POST -> comment_on_post
   * 2. DEFAULT RETURN "site_invitation"
   */
  private getDefaultTemplateKeyForType(type: string): string {
    switch (type) {
      case NotificationType.SITE_INVITATION:
        return EMAIL_TEMPLATE_KEYS.SITE_INVITATION;
      case NotificationType.PASSWORD_RESET:
        return EMAIL_TEMPLATE_KEYS.PASSWORD_RESET;
      case NotificationType.COMMENT_ON_POST:
        return EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST;
      case NotificationType.WELCOME:
        return EMAIL_TEMPLATE_KEYS.WELCOME;
      default:
        return "site_invitation";
    }
  }

  /**
   * PSEUDOCODE:
   * 1. DELEGATE to repository.findByUserId(userId, options)
   * 2. RETURN paginated result
   */
  async listByUserId(userId: string, options: ListNotificationsOptions): Promise<ListNotificationsResult> {
    return this.notificationRepository.findByUserId(userId, options) as Promise<ListNotificationsResult>;
  }

  /**
   * PSEUDOCODE:
   * 1. RETURN repository.countUnreadByUserId(userId)
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.countUnreadByUserId(userId);
  }

  /**
   * PSEUDOCODE:
   * 1. RETURN repository.markRead(notificationId, userId)
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    return this.notificationRepository.markRead(notificationId, userId);
  }

  /**
   * PSEUDOCODE:
   * 1. RETURN repository.markAllRead(userId)
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.notificationRepository.markAllRead(userId);
  }
}
