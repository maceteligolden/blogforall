import { injectable } from "tsyringe";
import { and, desc, eq } from "drizzle-orm";
import { generateApiKey } from "../../../shared/utils/api-key";
import { encryptWorkspaceApiKeySecret } from "../../../shared/utils/workspace-api-key-crypto";
import { db } from "../../../shared/database";
import { workspaceApiKeys } from "../../../shared/database/schema";

@injectable()
export class ApiKeyRepository {
  async createApiKey(
    siteId: string,
    userId: string,
    name: string
  ): Promise<{ accessKeyId: string; secretKey: string; hashedSecret: string; secret_encrypted: string }> {
    const keyPair = generateApiKey();
    const secret_encrypted = encryptWorkspaceApiKeySecret(keyPair.secretKey);

    await db.insert(workspaceApiKeys).values({
      site_id: siteId,
      user_id: userId,
      name,
      accessKeyId: keyPair.accessKeyId,
      hashedSecret: keyPair.hashedSecret,
      secret_encrypted,
      createdAt: new Date(),
      isActive: true,
    });

    return {
      accessKeyId: keyPair.accessKeyId,
      secretKey: keyPair.secretKey,
      hashedSecret: keyPair.hashedSecret,
      secret_encrypted,
    };
  }

  async listBySite(siteId: string): Promise<
    Array<{
      name: string;
      accessKeyId: string;
      secret_encrypted: string;
      createdAt: Date;
      lastUsed?: Date;
      isActive: boolean;
    }>
  > {
    const keys = await db
      .select()
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.site_id, siteId))
      .orderBy(desc(workspaceApiKeys.createdAt));

    return keys.map((k) => ({
      name: k.name,
      accessKeyId: k.accessKeyId,
      secret_encrypted: k.secret_encrypted,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed ?? undefined,
      isActive: k.isActive,
    }));
  }

  async deleteBySiteAndAccessKey(siteId: string, accessKeyId: string): Promise<boolean> {
    const rows = await db
      .delete(workspaceApiKeys)
      .where(and(eq(workspaceApiKeys.site_id, siteId), eq(workspaceApiKeys.accessKeyId, accessKeyId)))
      .returning({ id: workspaceApiKeys.id });
    return rows.length > 0;
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await db.delete(workspaceApiKeys).where(eq(workspaceApiKeys.site_id, siteId));
  }

  async findByAccessKeyId(accessKeyId: string): Promise<{
    siteId: string;
    userId: string;
    apiKey: {
      accessKeyId: string;
      hashedSecret: string;
      isActive: boolean;
    };
  } | null> {
    const [row] = await db
      .select()
      .from(workspaceApiKeys)
      .where(eq(workspaceApiKeys.accessKeyId, accessKeyId))
      .limit(1);
    if (!row) return null;

    return {
      siteId: row.site_id,
      userId: row.user_id,
      apiKey: {
        accessKeyId: row.accessKeyId,
        hashedSecret: row.hashedSecret,
        isActive: row.isActive,
      },
    };
  }

  async updateLastUsed(siteId: string, accessKeyId: string): Promise<void> {
    await db
      .update(workspaceApiKeys)
      .set({ lastUsed: new Date() })
      .where(and(eq(workspaceApiKeys.site_id, siteId), eq(workspaceApiKeys.accessKeyId, accessKeyId)));
  }
}
