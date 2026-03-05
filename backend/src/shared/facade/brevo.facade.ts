import { injectable } from "tsyringe";
import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../config/env";
import { AppError } from "../errors";
import { logger } from "../utils/logger";

/** Input for sending a transactional email via Brevo. */
export interface BrevoSendInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  correlationId: string;
  notificationId: string;
  templateId?: number;
  templateParams?: Record<string, string>;
}

/** Result of a successful send. */
export interface BrevoSendOutput {
  messageId: string;
}

/** Request payload built for Brevo sendTransacEmail API. */
export interface BrevoTransacEmailRequest {
  sender: { name: string; email: string };
  to: { email: string }[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number;
  params?: Record<string, unknown>;
}

/** Facade over Brevo Transactional Email API. Config from shared/config/env. */
@injectable()
export class BrevoFacade {
  private client: BrevoClient | null = null;

  /**
   * PSEUDOCODE:
   * 1. IF env.notification.brevoApiKey is set: CREATE BrevoClient with apiKey
   * 2. ELSE: LOG warning (no-op mode)
   */
  constructor() {
    if (env.notification.brevoApiKey) {
      this.client = new BrevoClient({ apiKey: env.notification.brevoApiKey });
    } else {
      logger.warn("BREVO_API_KEY not set; email sending will be no-op.", {}, "BrevoFacade");
    }
  }

  /**
   * PSEUDOCODE:
   * 1. IF client not configured: THROW AppError(503)
   * 2. BUILD request: sender from env, to from input, subject; IF templateId: set templateId and params ELSE set htmlContent/textContent
   * 3. TRY: CALL sendTransacEmail(request), EXTRACT messageId from response, LOG success, RETURN { messageId }
   * 4. CATCH: rethrow AppError else THROW AppError(502) with message
   */
  async send(input: BrevoSendInput): Promise<BrevoSendOutput> {
    if (!this.client) {
      throw new AppError("Brevo API not configured. Set BREVO_API_KEY.", 503);
    }

    const request: BrevoTransacEmailRequest = {
      sender: {
        name: env.notification.brevoSenderName,
        email: env.notification.brevoSenderEmail,
      },
      to: [{ email: input.to }],
      subject: input.subject,
    };

    if (input.templateId != null) {
      request.templateId = input.templateId;
      if (input.templateParams && Object.keys(input.templateParams).length > 0) {
        request.params = input.templateParams as Record<string, unknown>;
      }
    } else {
      if (input.html) request.htmlContent = input.html;
      if (input.text) request.textContent = input.text;
    }

    try {
      const response = await this.client.transactionalEmails.sendTransacEmail(request);
      const messageId =
        (response && typeof response === "object" && "messageId" in response
          ? (response as { messageId?: string }).messageId
          : undefined) ?? "";

      logger.info(
        "Brevo email sent",
        {
          notificationId: input.notificationId,
          correlationId: input.correlationId,
          messageId,
          to: input.to.substring(0, 3) + "***",
        },
        "BrevoFacade"
      );

      return { messageId };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "Brevo send failed";
      throw new AppError(message, 502);
    }
  }
}
