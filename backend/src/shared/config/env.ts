/**
 * Global env configuration. All process.env reads live here; keys documented in .env.example.
 */

import fs from "fs";
import path from "path";
import { config as dotenvConfig } from "dotenv";

/** Load .env before reading variables (covers import-order issues and cwd = repo root vs backend/). */
function loadEnvFiles(): void {
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "backend", ".env")];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      dotenvConfig({ path: filePath, override: true });
    }
  }
}

loadEnvFiles();

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : defaultValue;
}

function parseFloatEnv(value: string | undefined, defaultValue: number): number {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : defaultValue;
}

function resolveObjectStorageConfig() {
  const s3Endpoint = (process.env.B2_S3_ENDPOINT || "").trim();
  const region = (process.env.B2_REGION || "").trim() || "us-west-004";
  const bucket = (process.env.B2_BUCKET || "").trim();
  const keyId = (process.env.B2_KEY_ID || "").trim();
  const applicationKey = (process.env.B2_APPLICATION_KEY || "").trim();
  const publicBaseUrl = (process.env.PUBLIC_ASSET_BASE_URL || "").trim().replace(/\/+$/, "");
  const required = [s3Endpoint, bucket, keyId, applicationKey, publicBaseUrl];
  const allSet = required.every((v) => v.length > 0);
  const anySet = required.some((v) => v.length > 0);
  if (anySet && !allSet) {
    const msg =
      "Incomplete object storage env: set B2_S3_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APPLICATION_KEY, PUBLIC_ASSET_BASE_URL (optional B2_REGION, defaults to us-west-004).";
    if ((process.env.NODE_ENV ?? "development") === "production") {
      throw new Error(msg);
    }
    // eslint-disable-next-line no-console -- logger imports env; avoid circular dependency
    console.warn(`[env] ${msg} Falling back to local disk uploads.`);
  }
  return {
    enabled: allSet,
    s3Endpoint,
    region,
    bucket,
    keyId,
    applicationKey,
    publicBaseUrl,
    /** When true, server startup runs S3 PutBucketAcl public-read once (app key must allow bucket ACL). */
    applyBucketPublicReadAcl: (process.env.B2_APPLY_BUCKET_PUBLIC_READ || "").toLowerCase() === "true",
  } as const;
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

  /** Backblaze B2 via S3-compatible API; when enabled, uploads use memory buffer + PutObject and PUBLIC_ASSET_BASE_URL for returned URLs. */
  objectStorage: resolveObjectStorageConfig(),

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

  blogGeneration: {
    HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || "").trim(),
    GENERATION_MODEL: process.env.BLOG_GENERATION_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",
    GENERATION_FALLBACK_MODELS: (
      process.env.BLOG_GENERATION_FALLBACK_MODELS ||
      "mistralai/Mixtral-8x7B-Instruct-v0.1,meta-llama/Llama-2-7b-chat-hf"
    )
      .split(",")
      .map((m) => m.trim()),
    ANALYSIS_MODEL: process.env.BLOG_ANALYSIS_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",
    ANALYSIS_FALLBACK_MODELS: (process.env.BLOG_ANALYSIS_FALLBACK_MODELS || "mistralai/Mixtral-8x7B-Instruct-v0.1")
      .split(",")
      .map((m) => m.trim()),
    API_TIMEOUT: parseIntEnv(process.env.BLOG_GENERATION_API_TIMEOUT, 120_000),
    MAX_PROMPT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MAX_PROMPT_LENGTH, 2000),
    DEFAULT_MIN_WORDS: parseIntEnv(process.env.BLOG_GENERATION_MIN_WORDS, 1000),
    DEFAULT_MAX_WORDS: parseIntEnv(process.env.BLOG_GENERATION_MAX_WORDS, 2000),
    MIN_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MIN_CONTENT_LENGTH, 500),
    MAX_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_GENERATION_MAX_CONTENT_LENGTH, 50_000),
    MAX_RETRIES: parseIntEnv(process.env.BLOG_GENERATION_MAX_RETRIES, 3),
    INITIAL_RETRY_DELAY: parseIntEnv(process.env.BLOG_GENERATION_INITIAL_RETRY_DELAY, 1000),
    MAX_RETRY_DELAY: parseIntEnv(process.env.BLOG_GENERATION_MAX_RETRY_DELAY, 10_000),
  },

  blogReview: {
    HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || "").trim(),
    REVIEW_MODEL: process.env.BLOG_REVIEW_MODEL || "HuggingFaceTB/SmolLM3-3B",
    API_TIMEOUT: parseIntEnv(process.env.BLOG_REVIEW_API_TIMEOUT, 60_000),
    MAX_CONTENT_LENGTH: parseIntEnv(process.env.BLOG_REVIEW_MAX_LENGTH, 50_000),
  },

  campaignAgent: {
    HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || "").trim(),
    AGENT_MODEL: process.env.CAMPAIGN_AGENT_MODEL || "HuggingFaceTB/SmolLM3-3B",
    MAX_HISTORY_TURNS: parseIntEnv(process.env.CAMPAIGN_AGENT_MAX_HISTORY_TURNS, 20),
    MAX_TOKENS: parseIntEnv(process.env.CAMPAIGN_AGENT_MAX_TOKENS, 1500),
    TEMPERATURE: parseFloatEnv(process.env.CAMPAIGN_AGENT_TEMPERATURE, 0.5),
    SESSION_TTL_MS: parseIntEnv(process.env.CAMPAIGN_AGENT_SESSION_TTL_MS, 7_200_000),
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
