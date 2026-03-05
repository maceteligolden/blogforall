/**
 * Notification service configuration and domain constants.
 * Env values are read from process.env; keys are documented in .env.example.
 */

export enum NotificationChannel {
  EMAIL = "email",
  IN_APP = "in_app",
}

export enum NotificationType {
  SITE_INVITATION = "site_invitation",
  COMMENT_ON_POST = "comment_on_post",
  LIKE_ON_POST = "like_on_post",
  INVITATION_ACCEPTED = "invitation_accepted",
  NEW_COMMENT_MODERATOR = "new_comment_moderator",
  PASSWORD_RESET = "password_reset",
}

export enum NotificationStatus {
  PENDING = "pending",
  SENDING = "sending",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  CREATED = "created",
  PUSHED = "pushed",
  READ = "read",
}

/** Brevo template keys (single point of update: map these to Brevo template IDs in EmailTemplateRegistry) */
export const EMAIL_TEMPLATE_KEYS = {
  SITE_INVITATION: "site_invitation",
  PASSWORD_RESET: "password_reset",
  COMMENT_ON_POST: "comment_on_post",
} as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[keyof typeof EMAIL_TEMPLATE_KEYS];

/** Default locale when none provided */
export const DEFAULT_EMAIL_LOCALE = "en";

/** Max retries for email job before moving to failed */
export const EMAIL_JOB_MAX_ATTEMPTS = 3;

/** Retention: days to keep read in-app notifications before archive/delete */
export const NOTIFICATION_RETENTION_DAYS_READ = 90;

/** Retention: days to keep email metadata in our DB */
export const EMAIL_METADATA_RETENTION_DAYS = 365;

/** Max connections per user for Socket.io (when implemented) */
export const MAX_SOCKET_CONNECTIONS_PER_USER = 3;

/** Env key names for notification service (reference only; resolved config in shared/config/env) */
export const NOTIFICATION_ENV_KEYS = {
  BREVO_API_KEY: "BREVO_API_KEY",
  BREVO_SENDER_EMAIL: "BREVO_SENDER_EMAIL",
  BREVO_SENDER_NAME: "BREVO_SENDER_NAME",
  REDIS_URL: "REDIS_URL",
  NOTIFICATION_RETENTION_DAYS_READ: "NOTIFICATION_RETENTION_DAYS_READ",
  EMAIL_METADATA_RETENTION_DAYS: "EMAIL_METADATA_RETENTION_DAYS",
  EMAIL_QUEUE_NAME: "EMAIL_QUEUE_NAME",
} as const;
