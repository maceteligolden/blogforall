import { injectable } from "tsyringe";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { NotFoundError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateApiKeyInput, ApiKeyResponse, ApiKeyListItem } from "../interfaces/api-key.interface";
import { verifyApiKeySecret } from "../../../shared/utils/api-key";

@injectable()
export class ApiKeyService {
  constructor(private apiKeyRepository: ApiKeyRepository) {}

  async createApiKey(userId: string, input: CreateApiKeyInput): Promise<ApiKeyResponse> {
    const { name } = input;
    const { accessKeyId, secretKey, hashedSecret } = await this.apiKeyRepository.createApiKey(userId, name);

    logger.info("API key created", { userId, accessKeyId }, "ApiKeyService");

    return {
      id: accessKeyId,
      name,
      accessKeyId,
      secretKey, // Only returned once on creation
      createdAt: new Date(),
      isActive: true,
    };
  }

  async getUserApiKeys(userId: string): Promise<ApiKeyListItem[]> {
    const apiKeys = await this.apiKeyRepository.getUserApiKeys(userId);
    
    return apiKeys.map((key) => ({
      id: key.accessKeyId,
      name: key.name,
      accessKeyId: key.accessKeyId,
      createdAt: key.createdAt,
      lastUsed: key.lastUsed,
      isActive: key.isActive,
    }));
  }

  async deleteApiKey(userId: string, accessKeyId: string): Promise<void> {
    // Verify the API key belongs to the user
    const userKeys = await this.apiKeyRepository.getUserApiKeys(userId);
    const keyExists = userKeys.some((key) => key.accessKeyId === accessKeyId);

    if (!keyExists) {
      throw new NotFoundError("API key not found");
    }

    await this.apiKeyRepository.deleteApiKey(userId, accessKeyId);
    logger.info("API key deleted", { userId, accessKeyId }, "ApiKeyService");
  }

  async verifyApiKey(accessKeyId: string, secretKey: string): Promise<{ userId: string }> {
    const userApiKey = await this.apiKeyRepository.findUserByApiKey(accessKeyId);

    if (!userApiKey) {
      throw new ForbiddenError("Invalid API credentials");
    }

    if (!userApiKey.apiKey.isActive) {
      throw new ForbiddenError("API key is inactive");
    }

    const isValid = verifyApiKeySecret(secretKey, userApiKey.apiKey.hashedSecret);
    if (!isValid) {
      throw new ForbiddenError("Invalid API credentials");
    }

    // Update last used timestamp (fire and forget)
    this.apiKeyRepository.updateLastUsed(userApiKey.userId, accessKeyId).catch((err) => {
      logger.error("Failed to update API key lastUsed", err as Error, {}, "ApiKeyService");
    });

    return { userId: userApiKey.userId };
  }
}

