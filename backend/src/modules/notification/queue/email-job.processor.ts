import { injectable } from "tsyringe";
import type { Job } from "bull";
import { BrevoFacade } from "../../../shared/facade/brevo.facade";
import { NotificationRepository } from "../repositories/notification.repository";
import { getTemplate } from "../../../shared/services/email-template.registry";
import { NotificationStatus } from "../../../shared/constants/notification.constant";
import { NotFoundError, AppError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import type { EmailJobPayload } from "../interfaces/email-job.interface";
import type { EmailTemplateKey } from "../../../shared/constants/notification.constant";

@injectable()
export class EmailJobProcessor {
  constructor(
    private readonly brevoFacade: BrevoFacade,
    private readonly notificationRepository: NotificationRepository
  ) {}

  /**
   * PSEUDOCODE:
   * 1. EXTRACT payload from job.data (notificationId, templateKey, recipientEmail, correlationId, params)
   * 2. FETCH notification by id from repository
   * 3. IF not found: THROW NotFoundError
   * 4. IF status is SENT or FAILED: RETURN (idempotent skip)
   * 5. TRY:
   *    a. GET rendered email from template registry (subject, html, text, templateId, params)
   *    b. CALL brevoFacade.send(...)
   *    c. UPDATE notification status to SENT, set email_message_id and sent_at
   * 6. CATCH:
   *    a. LOG error with context
   *    b. UPDATE notification status to FAILED, set failed_at
   *    c. RETHROW AppError or wrap in AppError
   */
  async handle(job: Job<EmailJobPayload>): Promise<void> {
    const { notificationId, templateKey, recipientEmail, correlationId, params } = job.data;

    const existing = await this.notificationRepository.findById(notificationId);
    if (!existing) {
      throw new NotFoundError(`Notification not found: ${notificationId}`);
    }
    if (existing.status === NotificationStatus.SENT || existing.status === NotificationStatus.FAILED) {
      return;
    }

    try {
      const rendered = getTemplate(templateKey as EmailTemplateKey, undefined, params);

      const result = await this.brevoFacade.send({
        to: recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        correlationId,
        notificationId,
        templateId: rendered.brevoTemplateId,
        templateParams: rendered.brevoParams,
      });

      await this.notificationRepository.updateStatus(notificationId, NotificationStatus.SENT, {
        email_message_id: result.messageId,
        sent_at: new Date(),
      });
    } catch (error: unknown) {
      logger.error(
        "Email job failed",
        error instanceof Error ? error : new Error(String(error)),
        { notificationId, correlationId, attempt: job.attemptsMade },
        "EmailJobProcessor"
      );
      await this.notificationRepository.updateStatus(notificationId, NotificationStatus.FAILED, {
        failed_at: new Date(),
      });
      if (error instanceof AppError) throw error;
      throw new AppError(error instanceof Error ? error.message : "Email send failed");
    }
  }
}
