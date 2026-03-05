import { injectable } from "tsyringe";
import type { Job } from "bull";
import { BrevoFacade } from "../../../shared/facade/brevo.facade";
import { NotificationRepository } from "../repositories/notification.repository";
import { getTemplate } from "../../../shared/services/email-template.registry";
import { NotificationStatus } from "../../../shared/constants/notification.constant";
import { logger } from "../../../shared/utils/logger";
import type { EmailJobPayload } from "./email-job.payload";
import type { EmailTemplateKey } from "../../../shared/constants/notification.constant";

@injectable()
export class EmailJobProcessor {
  constructor(
    private readonly brevoFacade: BrevoFacade,
    private readonly notificationRepository: NotificationRepository
  ) {}

  async handle(job: Job<EmailJobPayload>): Promise<void> {
    const { notificationId, templateKey, recipientEmail, correlationId, params } = job.data;

    const existing = await this.notificationRepository.findById(notificationId);
    if (!existing) {
      logger.warn("Email job: notification not found, skipping", { notificationId, jobId: job.id }, "EmailJobProcessor");
      return;
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
    } catch (error) {
      logger.error(
        "Email job failed",
        error as Error,
        { notificationId, correlationId, attempt: job.attemptsMade },
        "EmailJobProcessor"
      );
      await this.notificationRepository.updateStatus(notificationId, NotificationStatus.FAILED, {
        failed_at: new Date(),
      });
      throw error;
    }
  }
}
