import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ApiKeyService } from "../services/api-key.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { CreateApiKeyInput } from "../interfaces/api-key.interface";

@injectable()
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = (req.validatedParams as { id: string }).id;
      const validatedData = req.validatedBody as CreateApiKeyInput;
      const apiKey = await this.apiKeyService.createApiKey(siteId, userId, validatedData);
      sendCreated(res, "API key created successfully", apiKey);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = (req.validatedParams as { id: string }).id;
      const apiKeys = await this.apiKeyService.getSiteApiKeys(siteId, userId);
      sendSuccess(res, "API keys retrieved successfully", apiKeys);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id: siteId, accessKeyId } = req.validatedParams as { id: string; accessKeyId: string };
      await this.apiKeyService.deleteApiKey(siteId, userId, accessKeyId);
      sendNoContent(res, "API key deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}
