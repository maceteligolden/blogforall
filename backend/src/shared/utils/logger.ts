type LogLevel = "info" | "error" | "warn" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

class Logger {
  private formatEntry(
    level: LogLevel,
    message: string,
    metadata?: unknown,
    context?: string,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      metadata,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
        },
      }),
    };
  }

  private executeLog(entry: LogEntry): void {
    const isProduction = process.env.NODE_ENV === "production";
    const logString = JSON.stringify(entry);

    if (isProduction) {
      console.log(logString);
    } else {
      const color =
        entry.level === "error"
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
  }

  info(message: string, metadata?: unknown, context?: string): void {
    this.executeLog(this.formatEntry("info", message, metadata, context));
  }

  error(message: string, error?: Error | unknown, metadata?: unknown, context?: string): void {
    this.executeLog(
      this.formatEntry(
        "error",
        message,
        metadata,
        context,
        error instanceof Error ? error : new Error(String(error))
      )
    );
  }

  warn(message: string, metadata?: unknown, context?: string): void {
    this.executeLog(this.formatEntry("warn", message, metadata, context));
  }

  debug(message: string, metadata?: unknown, context?: string): void {
    if (process.env.NODE_ENV !== "production") {
      this.executeLog(this.formatEntry("debug", message, metadata, context));
    }
  }
}

export const logger = new Logger();

