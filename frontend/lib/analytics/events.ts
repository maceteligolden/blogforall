/**
 * Single source of truth for product analytics event names.
 * Format: [object] [action] (lowercase, space-separated).
 * GA4 snake_case names are mapped in ga4-event-map.ts.
 */
export const AnalyticsEvents = {
  // Auth
  SIGNUP_STARTED: "signup started",
  SIGNUP_COMPLETED: "signup completed",
  SIGNUP_FAILED: "signup failed",
  USER_SIGNED_UP: "user signed up",
  LOGIN_STARTED: "login started",
  LOGIN_SUCCESS: "login success",
  LOGIN_FAILED: "login failed",
  LOGOUT: "user logged out",
  PASSWORD_RESET_STARTED: "password reset started",
  PASSWORD_RESET_COMPLETED: "password reset completed",
  PASSWORD_RESET_FAILED: "password reset failed",

  // User billing onboarding
  ONBOARDING_STARTED: "onboarding started",
  ONBOARDING_STEP_COMPLETED: "onboarding step completed",
  ONBOARDING_COMPLETED: "onboarding completed",
  ONBOARDING_DROPPED: "onboarding dropped",
  ONBOARDING_BILLING_COMPLETED: "onboarding billing completed",
  ONBOARDING_BILLING_SKIPPED: "onboarding billing skipped",
  PLAN_SELECTED: "plan selected",
  USER_ONBOARDING_COMPLETED: "user onboarding completed",

  // Workspace
  WORKSPACE_CREATION_STARTED: "workspace creation started",
  WORKSPACE_CREATED: "workspace created",
  WORKSPACE_SWITCHED: "workspace switched",
  WORKSPACE_DELETED: "workspace deleted",
  WORKSPACE_UPDATED: "workspace updated",
  WORKSPACE_ONBOARDING_COMPLETED: "workspace onboarding completed",
  INVITE_PROMPT_VIEWED: "invite prompt viewed",
  INVITE_PROMPT_SKIPPED: "invite prompt skipped",

  // Dashboard setup checklist
  SETUP_CHECKLIST_OPENED: "setup checklist opened",
  SETUP_CHECKLIST_ITEM_COMPLETED: "setup checklist item completed",
  SETUP_COMPLETE: "setup complete",

  // Generation (core)
  GENERATION_FLOW_VIEWED: "generation flow viewed",
  GENERATION_TYPE_SELECTED: "generation type selected",
  GENERATION_INITIATED: "generation initiated",
  GENERATION_STARTED: "generation started",
  GENERATION_CONFIRMED: "generation confirmed",
  GENERATION_SUCCESS: "generation success",
  GENERATION_FAILED: "generation failed",
  GENERATION_RETRY: "generation retry",
  GENERATION_ABANDONED: "generation abandoned",
  BLOG_SAVED: "blog saved",
  BLOG_PUBLISHED: "blog published",

  // Billing
  BILLING_VIEWED: "billing viewed",
  PAYMENT_METHOD_ADDED: "payment method added",
  PLAN_CHANGED: "plan changed",
  SUBSCRIPTION_CANCELLED: "subscription cancelled",

  // Orchestrator
  ORCHESTRATOR_OPENED: "orchestrator opened",
  ORCHESTRATOR_MESSAGE_SENT: "orchestrator message sent",
  ORCHESTRATOR_TOOL_EXECUTED: "orchestrator tool executed",
  ORCHESTRATOR_APPROVAL_DECIDED: "orchestrator approval decided",

  // Profile
  PROFILE_UPDATED: "profile updated",
  PASSWORD_CHANGED: "password changed",

  // Landing / waitlist / beta gate
  LANDING_CTA_CLICKED: "landing cta clicked",
  LANDING_PRICING_LOCKED_CLICKED: "landing pricing locked clicked",
  WAITLIST_JOIN_STARTED: "waitlist join started",
  WAITLIST_JOINED: "waitlist joined",
  WAITLIST_JOIN_FAILED: "waitlist join failed",
  TERMS_ACCEPTED: "terms accepted",
  BETA_WAITING_VIEWED: "beta waiting viewed",
  BETA_STATUS_CHECKED: "beta status checked",
  PLAN_UPGRADE_BLOCKED: "plan upgrade blocked",

  // System / failures
  API_CALL_FAILED: "api call failed",
  PAGE_VIEW: "$pageview",
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
