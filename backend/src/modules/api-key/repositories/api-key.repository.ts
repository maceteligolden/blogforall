import { injectable } from "tsyringe";
import mongoose from "mongoose";
import WorkspaceApiKey from "../../../shared/schemas/workspace-api-key.schema";
import { generateApiKey } from "../../../shared/utils/api-key";
import { encryptWorkspaceApiKeySecret } from "../../../shared/utils/workspace-api-key-crypto";

@injectable()
export class ApiKeyRepository {
  async createApiKey(
    siteId: string,
    userId: string,
    name: string
  ): Promise<{ accessKeyId: string; secretKey: string; hashedSecret: string; secret_encrypted: string }> {
    const keyPair = generateApiKey();
    const secret_encrypted = encryptWorkspaceApiKeySecret(keyPair.secretKey);

    await WorkspaceApiKey.create({
      site_id: new mongoose.Types.ObjectId(siteId),
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
    const keys = await WorkspaceApiKey.find({
      site_id: new mongoose.Types.ObjectId(siteId),
    })
      .sort({ createdAt: -1 })
      .lean();
    return keys.map((k) => ({
      name: k.name,
      accessKeyId: k.accessKeyId,
      secret_encrypted: k.secret_encrypted,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
      isActive: k.isActive,
    }));
  }

  async deleteBySiteAndAccessKey(siteId: string, accessKeyId: string): Promise<boolean> {
    const res = await WorkspaceApiKey.deleteOne({
      site_id: new mongoose.Types.ObjectId(siteId),
      accessKeyId,
    });
    return res.deletedCount > 0;
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await WorkspaceApiKey.deleteMany({ site_id: new mongoose.Types.ObjectId(siteId) });
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
    const doc = await WorkspaceApiKey.findOne({ accessKeyId }).lean();
    if (!doc) return null;

    return {
      siteId: doc.site_id.toString(),
      userId: doc.user_id,
      apiKey: {
        accessKeyId: doc.accessKeyId,
        hashedSecret: doc.hashedSecret,
        isActive: doc.isActive,
      },
    };
  }

  async updateLastUsed(siteId: string, accessKeyId: string): Promise<void> {
    await WorkspaceApiKey.updateOne(
      { site_id: new mongoose.Types.ObjectId(siteId), accessKeyId },
      { $set: { lastUsed: new Date() } }
    );
  }
}
