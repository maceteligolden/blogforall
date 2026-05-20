const SENSITIVE_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "apiKey",
  "password",
  "secret",
  "secretkey",
  "secret_key",
  "refresh_token",
  "access_token",
  "token",
  "x-secret-key",
]);

const TRUNCATE_KEYS = new Set([
  "prompt",
  "prompttext",
  "content",
  "contexttext",
  "message",
  "messages",
  "generation_prompt",
  "rework_comments",
]);

const MAX_TRUNCATE_LENGTH = 200;

function truncateString(value: string): string {
  if (value.length <= MAX_TRUNCATE_LENGTH) return value;
  return `${value.slice(0, MAX_TRUNCATE_LENGTH)}…[truncated ${value.length} chars]`;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (depth > 6) return "[max depth]";

  const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");

  if (SENSITIVE_KEYS.has(key.toLowerCase()) || SENSITIVE_KEYS.has(normalizedKey)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    if (TRUNCATE_KEYS.has(normalizedKey) || TRUNCATE_KEYS.has(key.toLowerCase())) {
      return truncateString(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(String(i), item, depth + 1));
  }

  if (value && typeof value === "object") {
    return sanitizeMetadata(value as Record<string, unknown>, depth + 1);
  }

  return value;
}

/** Strip secrets and truncate large prompt/content fields before logging or Sentry. */
export function sanitizeMetadata(
  metadata?: Record<string, unknown> | unknown,
  depth = 0
): Record<string, unknown> | undefined {
  if (metadata === undefined || metadata === null) return undefined;
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    return { value: sanitizeValue("value", metadata, depth) };
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    result[key] = sanitizeValue(key, value, depth + 1);
  }
  return result;
}
