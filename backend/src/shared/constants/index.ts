export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum UserPlan {
  FREE = "free",
}

export enum BlogStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  PUBLISHED = "published",
  UNPUBLISHED = "unpublished",
}

export enum SiteMemberRole {
  OWNER = "owner",
  ADMIN = "admin",
  EDITOR = "editor",
  VIEWER = "viewer",
}

/**
 * Workspace (Site) lifecycle status.
 * - `onboarding`: site exists but the owner has not yet completed the mandatory
 *   orchestrator-guided onboarding chat to populate workspace memory.
 * - `active`: workspace context has been captured; full dashboard is available.
 */
export enum SiteStatus {
  ONBOARDING = "onboarding",
  ACTIVE = "active",
}

export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}

export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}

// Re-export campaign constants
export { CampaignStatus, PostFrequency, ScheduledPostStatus, CampaignTemplateType } from "./campaign.constant";

// Re-export notification constants (resolved config in shared/config/env)
export {
  NotificationChannel,
  NotificationType,
  NotificationStatus,
  EMAIL_TEMPLATE_KEYS,
  NOTIFICATION_ENV_KEYS,
} from "./notification.constant";
export type { EmailTemplateKey } from "./notification.constant";
