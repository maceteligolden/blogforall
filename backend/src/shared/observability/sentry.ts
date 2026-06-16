/**
 * Sentry backend initialization and safe wrappers.
 *
 * Alert rules (configure in Sentry UI — no custom email code):
 * - level:fatal OR tags.flow:token-reservation,openai-request,auth,billing
 * - Error spike: event.type:error count > threshold in 5m (production)
 * - Token failures: tags.flow:token-reservation
 */
import * as Sentry from "@sentry/node";
import { env } from "../config/env";
import { sanitizeMetadata } from "./sanitize";
import type { RequestContextStore } from "./request-context";

let initialized = false;

export function isSentryEnabled(): boolean {
  if (!env.sentry.enabled) return false;
  return Boolean(env.sentry.dsn?.trim());
}

/** Never throws — safe wrapper for all Sentry SDK calls. */
export function safeSentry<T>(fn: () => T): T | undefined {
  if (!isSentryEnabled()) return undefined;
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.extra) {
    event.extra = sanitizeMetadata(event.extra as Record<string, unknown>);
  }
  if (event.contexts) {
    for (const key of Object.keys(event.contexts)) {
      const ctx = event.contexts[key];
      if (ctx && typeof ctx === "object") {
        event.contexts[key] = sanitizeMetadata(ctx as Record<string, unknown>);
      }
    }
  }
  return event;
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  if (breadcrumb.data) {
    breadcrumb.data = sanitizeMetadata(breadcrumb.data as Record<string, unknown>);
  }
  if (typeof breadcrumb.message === "string" && breadcrumb.message.length > 500) {
    breadcrumb.message = `${breadcrumb.message.slice(0, 500)}…`;
  }
  return breadcrumb;
}

export function initSentry(): void {
  if (initialized || !isSentryEnabled()) return;

  const integrations: ReturnType<typeof Sentry.httpIntegration>[] = [
    Sentry.httpIntegration(),
    Sentry.expressIntegration(),
  ];

  Sentry.init({
    dsn: env.sentry.dsn,
    environment: env.sentry.environment,
    tracesSampleRate: env.sentry.tracesSampleRate,
    integrations,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    tracesSampler: (samplingContext) => {
      const name = samplingContext.name ?? "";
      const transactionName = samplingContext.transactionContext?.name ?? "";
      const path = `${name} ${transactionName}`;
      if (
        path.includes("orchestrator") ||
        path.includes("blogs/generate") ||
        path.includes("/usage")
      ) {
        return Math.min(1, env.sentry.tracesSampleRate * 2);
      }
      return env.sentry.tracesSampleRate;
    },
  });

  initialized = true;
}

export function setSentryScopeFromContext(ctx: RequestContextStore): void {
  safeSentry(() => {
    Sentry.setTag("requestId", ctx.requestId);
    if (ctx.userId) Sentry.setUser({ id: ctx.userId });
    if (ctx.sessionId) Sentry.setTag("sessionId", ctx.sessionId);
    if (ctx.flow) Sentry.setTag("flow", ctx.flow);
    Sentry.setContext("request", {
      requestId: ctx.requestId,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      flow: ctx.flow,
    });
  });
}

export function addSentryBreadcrumb(
  message: string,
  level: Sentry.SeverityLevel,
  data?: Record<string, unknown>
): void {
  safeSentry(() => {
    Sentry.addBreadcrumb({
      message,
      level,
      data: sanitizeMetadata(data),
    });
  });
}

export function captureSentryException(
  error: unknown,
  options?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  safeSentry(() => {
    Sentry.withScope((scope) => {
      if (options?.level) scope.setLevel(options.level);
      if (options?.tags) {
        for (const [k, v] of Object.entries(options.tags)) {
          scope.setTag(k, v);
        }
      }
      if (options?.extra) {
        const sanitized = sanitizeMetadata(options.extra);
        if (sanitized) scope.setContext("extra", sanitized);
      }
      if (error instanceof Error) {
        Sentry.captureException(error);
      } else {
        Sentry.captureMessage(String(error), options?.level ?? "error");
      }
    });
  });
}

export function continueIncomingTrace<T>(
  req: { headers: Record<string, string | string[] | undefined> },
  fn: () => T
): T {
  if (!isSentryEnabled()) return fn();

  const sentryTrace = req.headers["sentry-trace"];
  const baggage = req.headers["baggage"];
  const traceHeader = Array.isArray(sentryTrace) ? sentryTrace[0] : sentryTrace;
  const baggageHeader = Array.isArray(baggage) ? baggage[0] : baggage;

  if (!traceHeader) return fn();

  return Sentry.continueTrace({ sentryTrace: traceHeader, baggage: baggageHeader }, fn);
}

export { setupExpressErrorHandler } from "@sentry/node";
