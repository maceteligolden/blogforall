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

const smtpFromDefault = (process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@bloggr.io").trim();

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

  campaign: {
    progressReportCron: (process.env.CAMPAIGN_PROGRESS_REPORT_CRON || "0 7 * * *").trim(),
    progressEmailCron: (process.env.CAMPAIGN_PROGRESS_EMAIL_CRON || "0 8 * * *").trim(),
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
    maxSearchResults: parseIntEnv(process.env.BLOG_AI_MAX_SEARCH_RESULTS, 12),
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
    /** Nightly job: roll orchestrator chat + tools into workspace_memory.memory_summary. */
    memoryDigestCron: (process.env.ORCHESTRATOR_MEMORY_DIGEST_CRON || "0 4 * * *").trim(),
    /** How far back (hours) to read orchestrator messages when building the digest. */
    memoryDigestLookbackHours: parseIntEnv(process.env.ORCHESTRATOR_MEMORY_DIGEST_LOOKBACK_HOURS, 48),
    /** Max workspaces processed per digest tick (fair rotation via oldest updated_at first). */
    memoryDigestMaxSitesPerRun: parseIntEnv(process.env.ORCHESTRATOR_MEMORY_DIGEST_MAX_SITES, 200),
    /** Milliseconds before a pending in-chat confirmation auto-rejects. */
    confirmTimeoutMs: parseIntEnv(process.env.ORCHESTRATOR_CONFIRM_TIMEOUT_MS, 600_000),
    /** Max rework rounds per scheduled post before manual editing is required. */
    maxReworkRounds: parseIntEnv(process.env.ORCHESTRATOR_MAX_REWORK_ROUNDS, 5),
    /** Secret used to sign scheduled-post review tokens (falls back to ACCESS_SECRET). */
    reviewTokenSecret: (process.env.ORCHESTRATOR_REVIEW_TOKEN_SECRET || process.env.ACCESS_SECRET || "").trim(),
    /**
     * v0.5 LangGraph orchestrator (CI → skills). Default **true** (M5).
     * Set ORCHESTRATOR_V05_GRAPH_ENABLED=false to use supervisor for active chat (emergency opt-out).
     * Onboarding always uses the supervisor path.
     */
    v05GraphEnabled: (process.env.ORCHESTRATOR_V05_GRAPH_ENABLED || "true").toLowerCase() !== "false",
    /**
     * Strategic Intelligence (doc 21 / ADR-015): Default Campaign binding, WorkspaceStrategy,
     * belief confidence, decision engine, learning loop. Default **true**.
     */
    strategicIntelligenceEnabled: (process.env.STRATEGIC_INTELLIGENCE_ENABLED || "true").toLowerCase() !== "false",
  },

  /** ElevenLabs TTS for orchestrator voice call mode (doc 22). */
  elevenlabs: {
    apiKey: (process.env.ELEVENLABS_API_KEY || "").trim(),
    voiceId: (process.env.ELEVENLABS_VOICE_ID || "bitB3zPqF1vZmMnmEMcw").trim(),
  },

  /**
   * @deprecated M5 — cognition dual-brain removed. Env var ignored; always disabled.
   */
  cognition: {
    enabled: false,
    utilityModel: (process.env.COGNITION_UTILITY_MODEL || "gpt-4o-mini").trim(),
    primaryModel: (
      process.env.COGNITION_PRIMARY_MODEL ||
      process.env.ORCHESTRATOR_SUPERVISOR_MODEL ||
      "gpt-4o-mini"
    ).trim(),
    memoryPackCacheTtlSec: parseIntEnv(process.env.COGNITION_MEMORY_PACK_CACHE_TTL_SEC, 90),
    researchMinSources: parseIntEnv(process.env.COGNITION_RESEARCH_MIN_SOURCES, 5),
    researchMaxSources: parseIntEnv(process.env.COGNITION_RESEARCH_MAX_SOURCES, 15),
    reasoningRetentionDays: parseIntEnv(process.env.COGNITION_REASONING_RETENTION_DAYS, 90),
    redisUrl: (process.env.COGNITION_REDIS_URL || process.env.REDIS_URL || "").trim(),
  },

  memory: {
    embeddingModel: (process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-3-small").trim(),
    contextPackTokenBudget: parseIntEnv(process.env.MEMORY_CONTEXT_PACK_TOKEN_BUDGET, 12_000),
    qdrantUrl: (process.env.QDRANT_URL || "").trim(),
    qdrantApiKey: (process.env.QDRANT_API_KEY || "").trim(),
    qdrantCollection: (process.env.QDRANT_COLLECTION || "workspace_memory").trim(),
    chunkSize: parseIntEnv(process.env.MEMORY_CHUNK_SIZE, 512),
    chunkOverlap: parseIntEnv(process.env.MEMORY_CHUNK_OVERLAP, 64),
    minImportanceScore: parseFloat(process.env.MEMORY_MIN_IMPORTANCE_SCORE || "0.4"),
    maxChunksPerTurn: parseIntEnv(process.env.MEMORY_MAX_CHUNKS_PER_TURN, 20),
  },

  googleDrive: {
    clientId: (process.env.GOOGLE_DRIVE_CLIENT_ID || "").trim(),
    clientSecret: (process.env.GOOGLE_DRIVE_CLIENT_SECRET || "").trim(),
    redirectUri: (process.env.GOOGLE_DRIVE_REDIRECT_URI || "").trim(),
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
  adminSeed: {
    onStart: (process.env.ADMIN_SEED_ON_START || "false").toLowerCase() === "true",
    email: process.env.ADMIN_SEED_EMAIL?.trim(),
    password: process.env.ADMIN_SEED_PASSWORD,
    firstName: process.env.ADMIN_SEED_FIRST_NAME?.trim(),
    lastName: process.env.ADMIN_SEED_LAST_NAME?.trim(),
    role: process.env.ADMIN_SEED_ROLE?.trim(),
  },
  tokenLedger: {
    defaultDailyFree: parseIntEnv(process.env.TOKEN_LEDGER_DEFAULT_DAILY_FREE, 400_000),
    activeRequestTtlMs: parseIntEnv(process.env.TOKEN_LEDGER_ACTIVE_REQUEST_TTL_MS, 240_000),
    windowMs: parseIntEnv(process.env.TOKEN_LEDGER_WINDOW_MS, 86_400_000),
  },

  sentry: {
    dsn: (process.env.SENTRY_DSN || "").trim(),
    environment: (process.env.SENTRY_ENVIRONMENT || NODE_ENV).trim(),
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (NODE_ENV === "production" ? "0.1" : "1.0")),
    enabled:
      process.env.SENTRY_ENABLED === undefined
        ? Boolean((process.env.SENTRY_DSN || "").trim())
        : process.env.SENTRY_ENABLED.toLowerCase() !== "false",
  },

  posthog: {
    apiKey: (process.env.POSTHOG_API_KEY || "").trim(),
    host: (process.env.POSTHOG_HOST || "https://us.i.posthog.com").trim(),
    environment: (process.env.POSTHOG_ENVIRONMENT || NODE_ENV).trim(),
    enabled:
      process.env.POSTHOG_ENABLED === undefined
        ? Boolean((process.env.POSTHOG_API_KEY || "").trim())
        : process.env.POSTHOG_ENABLED.toLowerCase() !== "false",
  },

  notification: {
    brevoApiKey: (process.env.BREVO_API_KEY || "").trim(),
    brevoSenderEmail: (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "noreply@bloggr.io").trim(),
    brevoSenderName: (process.env.BREVO_SENDER_NAME || "Bloggr").trim(),
    brevoWaitlistListId: parseIntEnv(process.env.BREVO_WAITLIST_LIST_ID, 0) || undefined,
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

  /**
   * Socket.io realtime layer (same HTTP process as Express).
   * See shared/realtime/.
   */
  realtime: {
    enabled: (process.env.REALTIME_ENABLED || "true").toLowerCase() !== "false",
    path: (process.env.REALTIME_PATH || "/socket.io").trim() || "/socket.io",
    namespace: (process.env.REALTIME_NAMESPACE || "/realtime").trim() || "/realtime",
    maxConnectionsPerUser: parseIntEnv(process.env.REALTIME_MAX_CONNECTIONS_PER_USER, 3),
    pingIntervalMs: parseIntEnv(process.env.REALTIME_PING_INTERVAL_MS, 25_000),
    pingTimeoutMs: parseIntEnv(process.env.REALTIME_PING_TIMEOUT_MS, 20_000),
    maxHttpBufferSize: parseIntEnv(process.env.REALTIME_MAX_HTTP_BUFFER_SIZE, 1_048_576),
    /** Inbound client events per socket per window. */
    inboundRateLimitMax: parseIntEnv(process.env.REALTIME_INBOUND_RATE_LIMIT_MAX, 60),
    inboundRateLimitWindowMs: parseIntEnv(process.env.REALTIME_INBOUND_RATE_LIMIT_WINDOW_MS, 60_000),
    /**
     * When true and REDIS_URL is set, attach @socket.io/redis-adapter for multi-instance emit.
     * Uses key prefix `realtime:socket.io:` to avoid colliding with Bull.
     */
    redisAdapterEnabled: (process.env.REALTIME_REDIS_ADAPTER_ENABLED || "false").toLowerCase() === "true",
  },
} as const;
