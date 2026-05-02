import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors";
import { HttpStatus } from "../constants";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const errorHandler = (error: Error | AppError, req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof AppError) {
    logger.error(error.message, error, { path: req.path, method: req.method }, "ErrorHandler");
    res.status(error.statusCode).json({
      message: error.message,
      ...(!env.isProduction && { stack: error.stack }),
    });
    return;
  }

  // Unknown errors
  logger.error("Unhandled error", error, { path: req.path, method: req.method }, "ErrorHandler");
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    message: "Internal server error",
    ...(!env.isProduction && { stack: error.stack }),
  });
};
