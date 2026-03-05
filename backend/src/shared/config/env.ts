/**
 * Global env configuration. All process.env reads live here; keys documented in .env.example.
 */

const NOTIFICATION_RETENTION_DAYS_READ_DEFAULT = 90;
const EMAIL_METADATA_RETENTION_DAYS_DEFAULT = 365;

export const env = {
  notification: {
    brevoApiKey: (process.env.BREVO_API_KEY || "").trim(),
    brevoSenderEmail: (
      process.env.BREVO_SENDER_EMAIL ||
      process.env.SMTP_FROM ||
      "noreply@blogforall.com"
    ).trim(),
    brevoSenderName: (process.env.BREVO_SENDER_NAME || "BlogForAll").trim(),
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    retentionDaysRead: parseInt(
      process.env.NOTIFICATION_RETENTION_DAYS_READ ||
        String(NOTIFICATION_RETENTION_DAYS_READ_DEFAULT),
      10
    ),
    emailMetadataRetentionDays: parseInt(
      process.env.EMAIL_METADATA_RETENTION_DAYS ||
        String(EMAIL_METADATA_RETENTION_DAYS_DEFAULT),
      10
    ),
    emailQueueName: process.env.EMAIL_QUEUE_NAME || "notification:email",
  },
} as const;
