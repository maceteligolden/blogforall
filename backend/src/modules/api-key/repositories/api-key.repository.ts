import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { generateApiKey } from "../../../shared/utils/api-key";

@injectable()
export class ApiKeyRepository {
  async createApiKey(
    userId: string,
    name: string
  ): Promise<{ accessKeyId: string; secretKey: string; hashedSecret: string }> {
    const keyPair = generateApiKey();

    await User.findByIdAndUpdate(userId, {
      $push: {
        apiKeys: {
          name,
          accessKeyId: keyPair.accessKeyId,
          hashedSecret: keyPair.hashedSecret,
          createdAt: new Date(),
          isActive: true,
        },
      },
      $set: { updated_at: new Date() },
    });

    return {
      accessKeyId: keyPair.accessKeyId,
      secretKey: keyPair.secretKey,
      hashedSecret: keyPair.hashedSecret,
    };
  }

  async getUserApiKeys(userId: string): Promise<
    Array<{
      _id?: string;
      name: string;
      accessKeyId: string;
      createdAt: Date;
      lastUsed?: Date;
      isActive: boolean;
    }>
  > {
    const user = await User.findById(userId).select("apiKeys");
    return user?.apiKeys || [];
  }

  async deleteApiKey(userId: string, accessKeyId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $pull: {
        apiKeys: { accessKeyId },
      },
      $set: { updated_at: new Date() },
    });
  }

  async deactivateApiKey(userId: string, accessKeyId: string): Promise<void> {
    await User.updateOne(
      { _id: userId, "apiKeys.accessKeyId": accessKeyId },
      {
        $set: {
          "apiKeys.$.isActive": false,
          updated_at: new Date(),
        },
      }
    );
  }

  async findUserByApiKey(accessKeyId: string): Promise<{
    userId: string;
    apiKey: {
      accessKeyId: string;
      hashedSecret: string;
      isActive: boolean;
    };
  } | null> {
    const user = await User.findOne({
      "apiKeys.accessKeyId": accessKeyId,
    }).select("_id apiKeys");

    if (!user) {
      return null;
    }

    const apiKey = user.apiKeys?.find((k) => k.accessKeyId === accessKeyId);
    if (!apiKey) {
      return null;
    }

    return {
      userId: user._id!.toString(),
      apiKey: {
        accessKeyId: apiKey.accessKeyId,
        hashedSecret: apiKey.hashedSecret,
        isActive: apiKey.isActive,
      },
    };
  }

  async updateLastUsed(userId: string, accessKeyId: string): Promise<void> {
    await User.updateOne(
      { _id: userId, "apiKeys.accessKeyId": accessKeyId },
      {
        $set: {
          "apiKeys.$.lastUsed": new Date(),
        },
      }
    );
  }
}
