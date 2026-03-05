import { injectable } from "tsyringe";
import { BrevoClient } from "@getbrevo/brevo";
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
  private client: BrevoClient | null = null;

  constructor() {
    if (NotificationConfig.brevoApiKey) {
      this.client = new BrevoClient({ apiKey: NotificationConfig.brevoApiKey });
    } else {
      logger.warn("BREVO_API_KEY not set; email sending will be no-op.", {}, "BrevoFacade");
    }
  }

  async send(params: BrevoSendParams): Promise<BrevoSendResult> {
    if (!this.client) {
      throw new Error("Brevo API not configured. Set BREVO_API_KEY.");
    }

    const request: {
      sender: { name: string; email: string };
      to: { email: string }[];
      subject: string;
      htmlContent?: string;
      textContent?: string;
      templateId?: number;
      params?: Record<string, unknown>;
    } = {
      sender: {
        name: NotificationConfig.brevoSenderName,
        email: NotificationConfig.brevoSenderEmail,
      },
      to: [{ email: params.to }],
      subject: params.subject,
    };

    if (params.templateId != null) {
      request.templateId = params.templateId;
      if (params.templateParams && Object.keys(params.templateParams).length > 0) {
        request.params = params.templateParams as Record<string, unknown>;
      }
    } else {
      if (params.html) request.htmlContent = params.html;
      if (params.text) request.textContent = params.text;
    }

    const response = await this.client.transactionalEmails.sendTransacEmail(request);
    const messageId =
      (response && typeof response === "object" && "messageId" in response
        ? (response as { messageId?: string }).messageId
        : undefined) ?? "";

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
