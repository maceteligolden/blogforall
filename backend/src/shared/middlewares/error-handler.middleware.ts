import { Request, Response, NextFunction } from "express";
import { AppError, AiConcurrencyError, TokenLimitExceededError } from "../errors";
import { HttpStatus } from "../constants";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const errorHandler = (error: Error | AppError, req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof AppError) {
    if (error.statusCode === HttpStatus.UNAUTHORIZED) {
      logger.warn(error.message, { path: req.path, method: req.method }, "ErrorHandler");
    } else {
      logger.error(error.message, error, { path: req.path, method: req.method }, "ErrorHandler");
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
    res.status(error.statusCode).json(body);
    return;
  }

  // Unknown errors
  logger.error("Unhandled error", error, { path: req.path, method: req.method }, "ErrorHandler");
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    message: "Internal server error",
    ...(!env.isProduction && { stack: error.stack }),
  });
};
