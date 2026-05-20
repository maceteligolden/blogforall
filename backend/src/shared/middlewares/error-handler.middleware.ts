import { Request, Response, NextFunction } from "express";
import { AppError, AiConcurrencyError, TokenLimitExceededError } from "../errors";
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
    } else if (error instanceof TokenLimitExceededError || error instanceof AiConcurrencyError) {
      AppLogger.warn(error.message, { ...baseMeta, code: error.code }, "ErrorHandler");
    } else {
      AppLogger.error(error.message, error, baseMeta, "ErrorHandler");
    }

    if (!(error instanceof TokenLimitExceededError) && !(error instanceof AiConcurrencyError)) {
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
    if (requestId) {
      body.request_id = requestId;
    }
    res.status(error.statusCode).json(body);
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
