export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
}

/** Platform-level admin roles (JWT `role`), not site workspace roles. */
export function isPlatformAdminRole(role: string | undefined): boolean {
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
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
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
}

export {
  TOKEN_WINDOW_MS,
  TOKEN_ACTIVE_REQUEST_TTL_MS,
  TOKEN_ESTIMATE_BUFFER_RATIO,
  TokenLedgerEntryStatus,
  TokenLedgerFeature,
  TOKEN_ERROR_CODES,
} from "./token-ledger.constant";

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
