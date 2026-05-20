import { env } from "../config/env";
import { getRequestContext } from "./request-context";
import { sanitizeMetadata } from "./sanitize";
import { addSentryBreadcrumb, captureSentryException } from "./sentry";
import type { ObservabilityFlowType } from "./flows";

type LogLevel = "info" | "error" | "warn" | "debug" | "critical";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: unknown;
  requestId?: string;
  userId?: string;
  flow?: string;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface LogMetadata {
  flow?: ObservabilityFlowType | string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

class AppLoggerImpl {
  private enrichMetadata(metadata?: LogMetadata): Record<string, unknown> | undefined {
    const ctx = getRequestContext();
    const merged: Record<string, unknown> = {
      ...(metadata ?? {}),
      ...(ctx?.requestId && !metadata?.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx?.userId && !metadata?.userId ? { userId: ctx.userId } : {}),
      ...(ctx?.flow && !metadata?.flow ? { flow: ctx.flow } : {}),
      ...(ctx?.sessionId && !metadata?.sessionId ? { sessionId: ctx.sessionId } : {}),
    };
    return sanitizeMetadata(Object.keys(merged).length ? merged : undefined);
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    context?: string,
    error?: Error
  ): LogEntry {
    const enriched = this.enrichMetadata(metadata);
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata: enriched,
      requestId: enriched?.requestId as string | undefined,
      userId: enriched?.userId as string | undefined,
      flow: enriched?.flow as string | undefined,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    };
  }

  private executeLog(entry: LogEntry): void {
    try {
      const isProduction = env.isProduction;
      const logString = JSON.stringify(entry);

      if (isProduction) {
        console.log(logString);
      } else {
        const color =
          entry.level === "error" || entry.level === "critical"
            ? "\x1b[31m"
            : entry.level === "warn"
              ? "\x1b[33m"
              : entry.level === "debug"
                ? "\x1b[36m"
                : "\x1b[32m";
        console.log(
          `${color}[${entry.level.toUpperCase()}]\x1b[0m ${entry.timestamp} ${entry.context ? `[\x1b[36m${entry.context}\x1b[0m] ` : ""}${entry.message}`
        );
        if (entry.metadata) console.dir(entry.metadata, { depth: null });
        if (entry.error?.stack) console.error(`\x1b[31m${entry.error.stack}\x1b[0m`);
      }
    } catch {
      // Never break application flow due to logging
    }
  }

  info(message: string, metadata?: LogMetadata, context?: string): void {
    try {
      const entry = this.formatEntry("info", message, metadata, context);
      this.executeLog(entry);
      addSentryBreadcrumb(message, "info", entry.metadata as Record<string, unknown>);
    } catch {
      // swallow
    }
  }

  warn(message: string, metadata?: LogMetadata, context?: string): void {
    try {
      const entry = this.formatEntry("warn", message, metadata, context);
      this.executeLog(entry);
      addSentryBreadcrumb(message, "warning", entry.metadata as Record<string, unknown>);
    } catch {
      // swallow
    }
  }

  error(
    message: string,
    error?: Error | unknown,
    metadata?: LogMetadata,
    context?: string
  ): void {
    try {
      const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
      const entry = this.formatEntry("error", message, metadata, context, err);
      this.executeLog(entry);
      captureSentryException(err ?? new Error(message), {
        level: "error",
        tags: {
          ...(entry.flow ? { flow: String(entry.flow) } : {}),
          ...(entry.requestId ? { requestId: String(entry.requestId) } : {}),
        },
        extra: entry.metadata as Record<string, unknown>,
      });
    } catch {
      // swallow
    }
  }

  critical(
    message: string,
    error?: Error | unknown,
    metadata?: LogMetadata,
    context?: string
  ): void {
    try {
      const err = error instanceof Error ? error : error ? new Error(String(error)) : new Error(message);
      const entry = this.formatEntry("critical", message, metadata, context, err);
      this.executeLog(entry);
      const flow = entry.flow ? String(entry.flow) : metadata?.flow ? String(metadata.flow) : undefined;
      captureSentryException(err, {
        level: "fatal",
        tags: {
          ...(flow ? { flow } : {}),
          ...(entry.requestId ? { requestId: String(entry.requestId) } : {}),
          ...(entry.userId ? { userId: String(entry.userId) } : {}),
        },
        extra: entry.metadata as Record<string, unknown>,
      });
    } catch {
      // swallow
    }
  }

  debug(message: string, metadata?: LogMetadata, context?: string): void {
    if (env.isProduction) return;
    try {
      this.executeLog(this.formatEntry("debug", message, metadata, context));
    } catch {
      // swallow
    }
  }
}

export const AppLogger = new AppLoggerImpl();

/** @deprecated Use AppLogger — kept for backward compatibility with existing imports. */
export const logger = AppLogger;
