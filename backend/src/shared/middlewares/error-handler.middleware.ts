import { Request, Response, NextFunction } from "express";
import { AppError, AiConcurrencyError, ThreadBusyError, TokenLimitExceededError } from "../errors";
import { HttpStatus } from "../constants";
import { env } from "../config/env";
import { AppLogger } from "../observability/logger";
import { captureSentryException } from "../observability/sentry";
import { getRequestIdFromContext } from "../observability/request-context";

export const errorHandler = (error: Error | AppError, req: Request, res: Response, _next: NextFunction): void => {
  const requestId = getRequestIdFromContext(req);
  const baseMeta = { path: req.path, method: req.method, requestId };

  if (error instanceof AppError) {
    if (error.statusCode === HttpStatus.UNAUTHORIZED) {
      AppLogger.warn(error.message, baseMeta, "ErrorHandler");
    } else if (
      error instanceof TokenLimitExceededError ||
      error instanceof AiConcurrencyError ||
      error instanceof ThreadBusyError
    ) {
      AppLogger.warn(error.message, { ...baseMeta, code: error.code }, "ErrorHandler");
    } else {
      AppLogger.error(error.message, error, baseMeta, "ErrorHandler");
    }

    if (
      !(error instanceof TokenLimitExceededError) &&
      !(error instanceof AiConcurrencyError) &&
      !(error instanceof ThreadBusyError)
    ) {
      if (error.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
        captureSentryException(error, {
          level: "error",
          tags: { requestId: requestId ?? "unknown" },
          extra: baseMeta,
        });
      }
    }

    const body: Record<string, unknown> = {
      message: error.message,
      ...(!env.isProduction && { stack: error.stack }),
    };
    if (error instanceof TokenLimitExceededError) {
      body.code = error.code;
      body.reset_at = error.resetAt.toISOString();
    }
    if (error instanceof AiConcurrencyError) {
      body.code = error.code;
    }
    if (error instanceof ThreadBusyError) {
      body.code = error.code;
      body.holder = error.holder;
    }
    if (requestId) {
      body.request_id = requestId;
    }
    res.status(error.statusCode).json(body);
    return;
  }

  const parseFailed =
    error instanceof SyntaxError &&
    ((error as SyntaxError & { type?: string }).type === "entity.parse.failed" ||
      /is not valid JSON/i.test(error.message));
  if (parseFailed) {
    AppLogger.warn("Invalid JSON body", baseMeta, "ErrorHandler");
    res.status(HttpStatus.BAD_REQUEST).json({
      message: "Invalid JSON body",
      ...(requestId ? { request_id: requestId } : {}),
    });
    return;
  }

  AppLogger.critical("Unhandled error", error, baseMeta, "ErrorHandler");

  if (!res.headersSent) {
    captureSentryException(error, {
      level: "fatal",
      tags: { requestId: requestId ?? "unknown" },
      extra: baseMeta,
    });
  }

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    message: "Internal server error",
    ...(requestId ? { request_id: requestId } : {}),
    ...(!env.isProduction && { stack: error.stack }),
  });
};
