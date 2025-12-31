import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../errors";
import { ApiKeyService } from "../../modules/api-key/services/api-key.service";
import { container } from "tsyringe";
import { logger } from "../utils/logger";

/**
 * Middleware to authenticate API requests using Access Key ID and Secret Key.
 * Expected headers:
 * - x-access-key-id
 * - x-secret-key
 */
export const apiKeyAuthMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const startTime = Date.now();
  const accessKeyId = req.headers["x-access-key-id"] as string;
  const secretKey = req.headers["x-secret-key"] as string;

  try {
    // Log incoming API key request
    logger.info("API key request received", {
      method: req.method,
      path: req.path,
      accessKeyId,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      query: req.query,
    }, "ApiKeyAuthMiddleware");

    if (!accessKeyId || !secretKey) {
      logger.warn("API key auth failed: Missing credentials", {
        method: req.method,
        path: req.path,
        accessKeyId: accessKeyId || "missing",
        ip: req.ip || req.socket.remoteAddress,
      }, "ApiKeyAuthMiddleware");
      return next(new UnauthorizedError("Missing API credentials (x-access-key-id, x-secret-key)"));
    }

    const apiKeyService = container.resolve(ApiKeyService);
    const { userId } = await apiKeyService.verifyApiKey(accessKeyId, secretKey);

    const authDuration = Date.now() - startTime;

    // Log successful authentication
    logger.info("API key authentication successful", {
      accessKeyId,
      userId,
      method: req.method,
      path: req.path,
      authDuration: `${authDuration}ms`,
    }, "ApiKeyAuthMiddleware");

    // Attach user info to request
    // For API key auth, we only need userId (email not required)
    req.user = {
      userId,
    };

    // Attach access key ID to request for logging in controllers
    (req as any).accessKeyId = accessKeyId;

    next();
  } catch (error) {
    const authDuration = Date.now() - startTime;
    logger.error("API key auth failed", error as Error, {
      accessKeyId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      authDuration: `${authDuration}ms`,
    }, "ApiKeyAuthMiddleware");
    next(new UnauthorizedError("Invalid API credentials"));
  }
};

