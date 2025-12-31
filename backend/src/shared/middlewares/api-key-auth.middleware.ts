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
  try {
    const accessKeyId = req.headers["x-access-key-id"] as string;
    const secretKey = req.headers["x-secret-key"] as string;

    if (!accessKeyId || !secretKey) {
      logger.warn("API key auth failed: Missing credentials", {}, "ApiKeyAuthMiddleware");
      return next(new UnauthorizedError("Missing API credentials (x-access-key-id, x-secret-key)"));
    }

    const apiKeyService = container.resolve(ApiKeyService);
    const { userId } = await apiKeyService.verifyApiKey(accessKeyId, secretKey);

    // Attach user info to request
    req.user = {
      userId,
      email: "", // Not needed for API key auth
    };

    next();
  } catch (error) {
    logger.error("API key auth failed", error as Error, {}, "ApiKeyAuthMiddleware");
    next(new UnauthorizedError("Invalid API credentials"));
  }
};

