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
    logger.debug("Verifying API key", { accessKeyId }, "ApiKeyService");

    const userApiKey = await this.apiKeyRepository.findUserByApiKey(accessKeyId);

    if (!userApiKey) {
      logger.warn("API key verification failed: Key not found", { accessKeyId }, "ApiKeyService");
      throw new ForbiddenError("Invalid API credentials");
    }

    if (!userApiKey.apiKey.isActive) {
      logger.warn(
        "API key verification failed: Key inactive",
        {
          accessKeyId,
          userId: userApiKey.userId,
        },
        "ApiKeyService"
      );
      throw new ForbiddenError("API key is inactive");
    }

    const isValid = verifyApiKeySecret(secretKey, userApiKey.apiKey.hashedSecret);
    if (!isValid) {
      logger.warn(
        "API key verification failed: Invalid secret",
        {
          accessKeyId,
          userId: userApiKey.userId,
        },
        "ApiKeyService"
      );
      throw new ForbiddenError("Invalid API credentials");
    }

    logger.info(
      "API key verified successfully",
      {
        accessKeyId,
        userId: userApiKey.userId,
      },
      "ApiKeyService"
    );

    // Update last used timestamp (fire and forget)
    this.apiKeyRepository.updateLastUsed(userApiKey.userId, accessKeyId).catch((err) => {
      logger.error(
        "Failed to update API key lastUsed",
        err as Error,
        {
          accessKeyId,
          userId: userApiKey.userId,
        },
        "ApiKeyService"
      );
    });

    return { userId: userApiKey.userId };
  }
}
