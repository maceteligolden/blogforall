import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  const accessKeyId = req.headers["x-access-key-id"] as string;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData: Record<string, unknown> = {
      duration: `${duration}ms`,
      statusCode: res.statusCode,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
    };

    // Include access key ID if present (for API key requests)
    if (accessKeyId) {
      logData.accessKeyId = accessKeyId;
      logData.authType = "api-key";
    } else if (req.headers.authorization) {
      logData.authType = "jwt";
    } else {
      logData.authType = "none";
    }

    // Include user ID if available
    if ((req as any).user?.userId) {
      logData.userId = (req as any).user.userId;
    }

    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, logData, "RequestLogger");
  });

  next();
};
