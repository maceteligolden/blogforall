import { injectable } from "tsyringe";
import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";
import { NotificationConfig } from "../constants/notification.constant";
import { logger } from "../utils/logger";

export interface BrevoSendParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  correlationId: string;
  notificationId: string;
  templateId?: number;
  templateParams?: Record<string, string>;
}

export interface BrevoSendResult {
  messageId: string;
}

/** Facade over Brevo Transactional Email API. Single point for sending; env from NotificationConfig. */
@injectable()
export class BrevoFacade {
  private api: TransactionalEmailsApi | null = null;

  constructor() {
    if (NotificationConfig.brevoApiKey) {
      this.api = new TransactionalEmailsApi();
      (this.api as unknown as { authentications: { apiKey: { apiKey: string } } }).authentications.apiKey.apiKey =
        NotificationConfig.brevoApiKey;
    } else {
      logger.warn("BREVO_API_KEY not set; email sending will be no-op.", {}, "BrevoFacade");
    }
  }

  async send(params: BrevoSendParams): Promise<BrevoSendResult> {
    if (!this.api) {
      throw new Error("Brevo API not configured. Set BREVO_API_KEY.");
    }

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: NotificationConfig.brevoSenderName,
      email: NotificationConfig.brevoSenderEmail,
    };
    sendSmtpEmail.to = [{ email: params.to }];
    sendSmtpEmail.subject = params.subject;
    if (params.templateId != null) {
      sendSmtpEmail.templateId = params.templateId;
      if (params.templateParams) {
        sendSmtpEmail.params = params.templateParams;
      }
    } else {
      if (params.html) sendSmtpEmail.htmlContent = params.html;
      if (params.text) sendSmtpEmail.textContent = params.text;
    }

    const response = await this.api.sendTransacEmail(sendSmtpEmail);
    const messageId = (response.body as { messageId?: string })?.messageId ?? "";

    logger.info(
      "Brevo email sent",
      {
        notificationId: params.notificationId,
        correlationId: params.correlationId,
        messageId,
        to: params.to.substring(0, 3) + "***",
      },
      "BrevoFacade"
    );

    return { messageId };
  }
}
