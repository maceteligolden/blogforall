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

/** Public-signup cohort. Existing accounts stay `standard` (unrestricted). */
export enum AccountType {
  STANDARD = "standard",
  BETA = "beta",
}

export function needsBetaApproval(
  user: { account_type?: string | null; is_approved?: boolean | null } | null | undefined
): boolean {
  return user?.account_type === AccountType.BETA && user.is_approved === false;
}

export enum BlogStatus {
  DRAFT = "draft",
  GENERATING = "generating",
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
 * - `onboarding`: legacy sites that started before chatless signup (migrated to active on read).
 * - `active`: workspace is usable; business memory may still be incomplete (dashboard checklist).
 */
export enum SiteStatus {
  ONBOARDING = "onboarding",
  ACTIVE = "active",
}

/** Owner signup wizard stages (derived from sites + user fields). */
export enum SignupWizardStage {
  EMAIL_VERIFICATION = "email_verification",
  COMPANY_ROLE = "company_role",
  PLAN_SELECTION = "plan_selection",
  WORKSPACE_NAME = "workspace_name",
  INVITE = "invite",
  STRATEGIST_SETUP = "strategist_setup",
  STRATEGIST_READY = "strategist_ready",
  COMPLETE = "complete",
}

/** Company roles collected during signup for AI personalization. */
export const COMPANY_ROLES = ["founder", "marketer", "content", "engineer", "agency", "other"] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

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
  ACCEPTED = 202,
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
