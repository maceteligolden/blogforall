/**
 * Global env configuration. All process.env reads live here; keys documented in .env.example.
 */

const NOTIFICATION_RETENTION_DAYS_READ_DEFAULT = 90;
const EMAIL_METADATA_RETENTION_DAYS_DEFAULT = 365;
const WORKSPACE_DEFAULT_NAME_DEFAULT = "My Workspace";
const INVITATION_EXPIRY_DAYS_DEFAULT = 7;
const FRONTEND_BASE_URL_DEFAULT = "http://localhost:3000";

export const env = {
  frontend: {
    baseUrl: process.env.FRONTEND_URL?.split(",")[0]?.trim() || FRONTEND_BASE_URL_DEFAULT,
    urls: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : ([] as string[]),
  },
  workspace: {
    defaultName: (process.env.WORKSPACE_DEFAULT_NAME || WORKSPACE_DEFAULT_NAME_DEFAULT).trim(),
    invitationExpiryDays: parseInt(process.env.INVITATION_EXPIRY_DAYS || String(INVITATION_EXPIRY_DAYS_DEFAULT), 10),
  },
  notification: {
    brevoApiKey: (process.env.BREVO_API_KEY || "").trim(),
    brevoSenderEmail: (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "noreply@blogforall.com").trim(),
    brevoSenderName: (process.env.BREVO_SENDER_NAME || "BlogForAll").trim(),
    redisUrl:
      process.env.REDIS_URL?.trim() ??
      (process.env.NODE_ENV === "development" ? "" : "redis://localhost:6379"),
    retentionDaysRead: parseInt(
      process.env.NOTIFICATION_RETENTION_DAYS_READ || String(NOTIFICATION_RETENTION_DAYS_READ_DEFAULT),
      10
    ),
    emailMetadataRetentionDays: parseInt(
      process.env.EMAIL_METADATA_RETENTION_DAYS || String(EMAIL_METADATA_RETENTION_DAYS_DEFAULT),
      10
    ),
    emailQueueName: process.env.EMAIL_QUEUE_NAME || "notification:email",
  },
} as const;
