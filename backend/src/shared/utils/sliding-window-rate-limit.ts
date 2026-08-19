import { TooManyRequestsError } from "../errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function __resetSlidingWindowRateLimitForTests(): void {
  buckets.clear();
}

/**
 * In-memory sliding window per key. Not global across Node processes.
 */
export function assertSlidingWindowRateLimit(
  key: string,
  opts: { windowMs: number; max: number; message: string }
): void {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return;
  }
  if (b.count >= opts.max) {
    throw new TooManyRequestsError(opts.message);
  }
  b.count += 1;
}
