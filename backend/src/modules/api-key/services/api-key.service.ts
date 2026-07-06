import { injectable } from "tsyringe";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { NotFoundError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateApiKeyInput, ApiKeyResponse, ApiKeyListItem } from "../interfaces/api-key.interface";
import { verifyApiKeySecret } from "../../../shared/utils/api-key";
import { SiteService } from "../../site/services/site.service";
import { SiteRepository } from "../../site/repositories/site.repository";
import { decryptWorkspaceApiKeySecret } from "../../../shared/utils/workspace-api-key-crypto";
import { assertSiteCapability, SiteCapability } from "../../../shared/utils/site-permissions.util";

@injectable()
export class ApiKeyService {
  constructor(
    private apiKeyRepository: ApiKeyRepository,
    private siteService: SiteService,
    private siteRepository: SiteRepository
  ) {}

  private async assertManageWorkspace(siteId: string, userId: string): Promise<void> {
    const role = await this.siteService.getUserRole(siteId, userId);
    assertSiteCapability(role, SiteCapability.MANAGE_WORKSPACE);
  }

  async createApiKey(siteId: string, userId: string, input: CreateApiKeyInput): Promise<ApiKeyResponse> {
    const { name } = input;
    await this.assertManageWorkspace(siteId, userId);

    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Workspace not found");
    }

    const { accessKeyId, secretKey } = await this.apiKeyRepository.createApiKey(siteId, userId, name);

    logger.info("API key created", { userId, siteId, accessKeyId }, "ApiKeyService");

    return {
      id: accessKeyId,
      name,
      accessKeyId,
      secretKey,
      sitePublicId: site.public_id,
      createdAt: new Date(),
      isActive: true,
    };
  }

  async getSiteApiKeys(siteId: string, userId: string): Promise<ApiKeyListItem[]> {
    await this.assertManageWorkspace(siteId, userId);

    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Workspace not found");
    }

    const keys = await this.apiKeyRepository.listBySite(siteId);

    return keys.map((key) => {
      let secretKey: string;
      try {
        secretKey = decryptWorkspaceApiKeySecret(key.secret_encrypted);
      } catch {
        secretKey = "[unable to decrypt — rotate this key]";
      }
      return {
        id: key.accessKeyId,
        name: key.name,
        accessKeyId: key.accessKeyId,
        secretKey,
        sitePublicId: site.public_id,
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        isActive: key.isActive,
      };
    });
  }

  async deleteApiKey(siteId: string, userId: string, accessKeyId: string): Promise<void> {
    await this.assertManageWorkspace(siteId, userId);

    const deleted = await this.apiKeyRepository.deleteBySiteAndAccessKey(siteId, accessKeyId);
    if (!deleted) {
      throw new NotFoundError("API key not found");
    }

    logger.info("API key deleted", { userId, siteId, accessKeyId }, "ApiKeyService");
  }

  async verifyApiKey(accessKeyId: string, secretKey: string): Promise<{ userId: string; siteId: string }> {
    logger.debug("Verifying API key", { accessKeyId }, "ApiKeyService");

    const row = await this.apiKeyRepository.findByAccessKeyId(accessKeyId);

    if (!row) {
      logger.warn("API key verification failed: Key not found", { accessKeyId }, "ApiKeyService");
      throw new ForbiddenError("Invalid API credentials");
    }

    if (!row.apiKey.isActive) {
      logger.warn("API key verification failed: Key inactive", { accessKeyId, siteId: row.siteId }, "ApiKeyService");
      throw new ForbiddenError("API key is inactive");
    }

    const isValid = verifyApiKeySecret(secretKey, row.apiKey.hashedSecret);
    if (!isValid) {
      logger.warn("API key verification failed: Invalid secret", { accessKeyId, siteId: row.siteId }, "ApiKeyService");
      throw new ForbiddenError("Invalid API credentials");
    }

    logger.info(
      "API key verified successfully",
      { accessKeyId, siteId: row.siteId, userId: row.userId },
      "ApiKeyService"
    );

    this.apiKeyRepository.updateLastUsed(row.siteId, accessKeyId).catch((err) => {
      logger.error(
        "Failed to update API key lastUsed",
        err as Error,
        { accessKeyId, siteId: row.siteId },
        "ApiKeyService"
      );
    });

    return { userId: row.userId, siteId: row.siteId };
  }
}
