import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const smtpHost = env.smtp.host;
    const smtpPort = env.smtp.port;
    const smtpUser = env.smtp.user;
    const smtpPassword = env.smtp.password;
    const smtpFrom = env.smtp.from;

    // If SMTP is not configured, create a test transporter (won't send emails)
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      logger.warn(
        "SMTP not configured. Email service will log emails instead of sending them.",
        { smtpHost: !!smtpHost, smtpPort: !!smtpPort, smtpUser: !!smtpUser, smtpPassword: !!smtpPassword },
        "EmailService"
      );

      // Create a test account transporter for development
      if (env.isDevelopment) {
        nodemailer
          .createTestAccount()
          .then((testAccount: nodemailer.TestAccount) => {
            this.transporter = nodemailer.createTransport({
              host: "smtp.ethereal.email",
              port: 587,
              secure: false,
              auth: {
                user: testAccount.user,
                pass: testAccount.pass,
              },
            });
          })
          .catch((error: Error) => {
            logger.error("Failed to create test email account", error, {}, "EmailService");
          });
      }
      return;
    }

    // Create production transporter
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpPort === "465", // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      from: smtpFrom,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const smtpFrom = env.smtp.from;

    // If transporter is not initialized, log the email instead
    if (!this.transporter) {
      logger.info(
        "Email not sent (SMTP not configured)",
        {
          to: options.to,
          subject: options.subject,
          preview: options.text || options.html.substring(0, 100),
        },
        "EmailService"
      );
      return;
    }

    try {
      const mailOptions = {
        from: smtpFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
      };

      const info = await this.transporter.sendMail(mailOptions);

      // In development with test account, log the preview URL
      if (env.isDevelopment && nodemailer.getTestMessageUrl) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          logger.info(`Email preview: ${previewUrl}`, { to: options.to, subject: options.subject }, "EmailService");
        }
      }

      logger.info(
        "Email sent successfully",
        { to: options.to, subject: options.subject, messageId: info.messageId },
        "EmailService"
      );
    } catch (error) {
      logger.error(
        "Failed to send email",
        error as Error,
        { to: options.to, subject: options.subject },
        "EmailService"
      );
      // Don't throw error - email failure shouldn't break the invitation flow
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }
}

export const emailService = new EmailService();
