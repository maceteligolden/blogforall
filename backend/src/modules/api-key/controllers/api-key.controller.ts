import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../services/api-key.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createApiKeySchema } from "../validations/api-key.validation";

@injectable()
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.params.id;
      if (!siteId) {
        return next(new BadRequestError("Workspace ID is required"));
      }

      const validatedData = createApiKeySchema.parse(req.body);
      const apiKey = await this.apiKeyService.createApiKey(siteId, userId, validatedData);
      sendCreated(res, "API key created successfully", apiKey);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.params.id;
      if (!siteId) {
        return next(new BadRequestError("Workspace ID is required"));
      }

      const apiKeys = await this.apiKeyService.getSiteApiKeys(siteId, userId);
      sendSuccess(res, "API keys retrieved successfully", apiKeys);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const siteId = req.params.id;
      const { accessKeyId } = req.params;
      if (!siteId || !accessKeyId) {
        return next(new BadRequestError("Workspace ID and access key ID are required"));
      }

      await this.apiKeyService.deleteApiKey(siteId, userId, accessKeyId);
      sendNoContent(res, "API key deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}
