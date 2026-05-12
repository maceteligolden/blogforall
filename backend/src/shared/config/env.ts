/**
 * Global env configuration. All process.env reads live here; keys documented in .env.example.
 */

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : defaultValue;
}

const NODE_ENV = process.env.NODE_ENV ?? "development";

const NOTIFICATION_RETENTION_DAYS_READ_DEFAULT = 90;
const EMAIL_METADATA_RETENTION_DAYS_DEFAULT = 365;
const WORKSPACE_DEFAULT_NAME_DEFAULT = "My Workspace";
const INVITATION_EXPIRY_DAYS_DEFAULT = 7;
const FRONTEND_BASE_URL_DEFAULT = "http://localhost:3000";

const smtpFromDefault = (process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bloggr.com").trim();

export const env = {
  nodeEnv: NODE_ENV,
  isDevelopment: NODE_ENV === "development",
  isProduction: NODE_ENV === "production",

  port: parseIntEnv(process.env.PORT, 3001),

  mongodbUri: (process.env.MONGODB_URI || "").trim(),

  jwt: {
    accessSecret: (process.env.ACCESS_SECRET || "").trim(),
    refreshSecret: (process.env.REFRESH_SECRET || "").trim(),
  },

  stripe: {
    apiKey: (process.env.STRIPE_API_KEY || "").trim(),
    webhookSecret: (process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
  },

  /** Public base URL for this API (e.g. image URLs). Falls back to localhost + port. */
  backendUrl: (process.env.BACKEND_URL || "").trim(),

  upload: {
    dir: (process.env.UPLOAD_DIR || "./uploads").trim() || "./uploads",
    maxFileSize: parseIntEnv(process.env.MAX_FILE_SIZE, 5_242_880),
  },

  smtp: {
    host: process.env.SMTP_HOST?.trim(),
    port: process.env.SMTP_PORT?.trim(),
    user: process.env.SMTP_USER?.trim(),
    password: process.env.SMTP_PASSWORD?.trim(),
    from: smtpFromDefault,
  },

  workspaceCrypto: {
    apiKeyEncryptionKey: (process.env.WORKSPACE_API_KEY_ENCRYPTION_KEY || "").trim(),
  },

  scheduler: {
    cronInterval: process.env.SCHEDULER_INTERVAL || "*/1 * * * *",
  },

  /**
   * Blog AI (LangGraph + OpenAI-compatible chat + optional Tavily search).
   * Use OPENAI_API_KEY or BLOG_AI_OPENAI_API_KEY.
   */
  blogAi: {
    openaiApiKey: (process.env.BLOG_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "").trim(),
    /** Chat model for analysis, drafting, and streaming (e.g. gpt-4o-mini). */
    chatModel: (process.env.BLOG_AI_CHAT_MODEL || "gpt-4o-mini").trim(),
    /** Optional separate model for review; defaults to chatModel. */
    reviewModel: (process.env.BLOG_AI_REVIEW_MODEL || process.env.BLOG_AI_CHAT_MODEL || "gpt-4o-mini").trim(),
    tavilyApiKey: (process.env.TAVILY_API_KEY || "").trim(),
    /** When false, skip web search even if Tavily key is set. */
    enableWebSearch: (process.env.BLOG_AI_ENABLE_WEB_SEARCH || "true").toLowerCase() !== "false",
    maxSearchResults: parseIntEnv(process.env.BLOG_AI_MAX_SEARCH_RESULTS, 8),
    searchMaxQueryLength: parseIntEnv(process.env.BLOG_AI_SEARCH_MAX_QUERY_LENGTH, 400),
    API_TIMEOUT: parseIntEnv(process.env.BLOG_GENERATION_API_TIMEOUT, 120_000),
    MAX_PROMPT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MAX_PROMPT_LENGTH, 2000),
    DEFAULT_MIN_WORDS: parseIntEnv(process.env.BLOG_GENERATION_MIN_WORDS, 1000),
    DEFAULT_MAX_WORDS: parseIntEnv(process.env.BLOG_GENERATION_MAX_WORDS, 2000),
    MIN_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MIN_CONTENT_LENGTH, 500),
    MAX_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MAX_CONTENT_LENGTH, 50_000),
    streamDraftTimeoutMs: parseIntEnv(process.env.BLOG_AI_STREAM_DRAFT_TIMEOUT_MS, 180_000),
    /** In-memory rate limit: max generate/analyze/stream requests per user per window. */
    rateLimitMaxRequests: parseIntEnv(process.env.BLOG_AI_RATE_LIMIT_MAX, 20),
    rateLimitWindowMs: parseIntEnv(process.env.BLOG_AI_RATE_LIMIT_WINDOW_MS, 60_000),
  },

  blogReview: {
    API_TIMEOUT: parseIntEnv(process.env.BLOG_REVIEW_API_TIMEOUT, 60_000),
    MAX_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_REVIEW_MAX_LENGTH, 50_000),
  },

  /**
   * Workspace Orchestrator Agent (LangGraph supervisor + DB-backed memory).
   * Reuses OpenAI key from blogAi; standalone settings tunable independently.
   */
  orchestrator: {
    openaiApiKey: (
      process.env.ORCHESTRATOR_OPENAI_API_KEY ||
      process.env.BLOG_AI_OPENAI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ""
    ).trim(),
    supervisorModel: (process.env.ORCHESTRATOR_SUPERVISOR_MODEL || "gpt-4o-mini").trim(),
    memoryDigestModel: (process.env.ORCHESTRATOR_MEMORY_DIGEST_MODEL || "gpt-4o-mini").trim(),
    API_TIMEOUT: parseIntEnv(process.env.ORCHESTRATOR_API_TIMEOUT, 120_000),
    /** Hard cap on stored messages per thread before older turns are summarized. */
    maxThreadMessages: parseIntEnv(process.env.ORCHESTRATOR_MAX_THREAD_MESSAGES, 80),
    /** Default hours before scheduled_at to prepare a draft and request approval. */
    reviewLeadTimeHoursDefault: parseIntEnv(process.env.ORCHESTRATOR_REVIEW_LEAD_TIME_HOURS, 72),
    /** TTL for signed review tokens sent in approval emails. */
    reviewTokenTtlDays: parseIntEnv(process.env.ORCHESTRATOR_REVIEW_TOKEN_TTL_DAYS, 14),
    /** Cron for the weekly publishing digest. Default: Mondays 09:00. */
    weeklyDigestCron: (process.env.ORCHESTRATOR_WEEKLY_DIGEST_CRON || "0 9 * * 1").trim(),
    /** Milliseconds before a pending in-chat confirmation auto-rejects. */
    confirmTimeoutMs: parseIntEnv(process.env.ORCHESTRATOR_CONFIRM_TIMEOUT_MS, 600_000),
    /** Max rework rounds per scheduled post before manual editing is required. */
    maxReworkRounds: parseIntEnv(process.env.ORCHESTRATOR_MAX_REWORK_ROUNDS, 5),
    /** Secret used to sign scheduled-post review tokens (falls back to ACCESS_SECRET). */
    reviewTokenSecret: (
      process.env.ORCHESTRATOR_REVIEW_TOKEN_SECRET ||
      process.env.ACCESS_SECRET ||
      ""
    ).trim(),
  },

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
    invitationExpiryDays: parseIntEnv(process.env.INVITATION_EXPIRY_DAYS, INVITATION_EXPIRY_DAYS_DEFAULT),
  },
  notification: {
    brevoApiKey: (process.env.BREVO_API_KEY || "").trim(),
    brevoSenderEmail: (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "noreply@bloggr.com").trim(),
    brevoSenderName: (process.env.BREVO_SENDER_NAME || "Bloggr").trim(),
    redisUrl: process.env.REDIS_URL?.trim() ?? (NODE_ENV === "development" ? "" : "redis://localhost:6379"),
    retentionDaysRead: parseIntEnv(
      process.env.NOTIFICATION_RETENTION_DAYS_READ,
      NOTIFICATION_RETENTION_DAYS_READ_DEFAULT
    ),
    emailMetadataRetentionDays: parseIntEnv(
      process.env.EMAIL_METADATA_RETENTION_DAYS,
      EMAIL_METADATA_RETENTION_DAYS_DEFAULT
    ),
    emailQueueName: process.env.EMAIL_QUEUE_NAME || "notification:email",
  },
} as const;
