/** Rolling window length for daily token accounting. */
export const TOKEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Stale AI request lock TTL — released automatically after this duration. */
export const TOKEN_ACTIVE_REQUEST_TTL_MS = 10 * 60 * 1000;

/** Safety buffer applied to pre-request estimates (15%). */
export const TOKEN_ESTIMATE_BUFFER_RATIO = 0.15;

export enum TokenLedgerEntryStatus {
  RESERVED = "reserved",
  COMMITTED = "committed",
  FAILED = "failed",
  RELEASED = "released",
}

/** Feature keys for attribution and estimation heuristics. */
export enum TokenLedgerFeature {
  ORCHESTRATOR_CHAT = "orchestrator_chat",
  ORCHESTRATOR_ONBOARDING = "orchestrator_onboarding",
  BLOG_ANALYZE = "blog_analyze",
  BLOG_GENERATE = "blog_generate",
  BLOG_REVIEW = "blog_review",
  MEMORY_DIGEST = "memory_digest",
  SCHEDULED_BLOG_PREPARE = "scheduled_blog_prepare",
}

export const TOKEN_ERROR_CODES = {
  TOKEN_LIMIT_EXCEEDED: "TOKEN_LIMIT_EXCEEDED",
  AI_REQUEST_IN_PROGRESS: "AI_REQUEST_IN_PROGRESS",
} as const;
