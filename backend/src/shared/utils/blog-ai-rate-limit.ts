import { BlogAiConfig } from "../constants/blog-generation.constant";
import { BadRequestError } from "../errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Clears in-memory buckets (for tests only). */
export function __resetBlogAiRateLimitForTests(): void {
  buckets.clear();
}

/**
 * Simple in-memory sliding window per user for blog AI endpoints (analyze, generate, stream).
 *
 * **Scaling:** Each Node process has its own counters. Behind multiple instances or restarts,
 * limits are not global—use Redis or an API gateway for strict production quotas.
 */
export function assertBlogAiRateLimit(userId: string): void {
  const now = Date.now();
  const windowMs = BlogAiConfig.rateLimitWindowMs;
  const max = BlogAiConfig.rateLimitMaxRequests;
  const b = buckets.get(userId);
  if (!b || now > b.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (b.count >= max) {
    throw new BadRequestError("Too many AI requests in a short period. Please wait a minute and try again.");
  }
  b.count += 1;
}
