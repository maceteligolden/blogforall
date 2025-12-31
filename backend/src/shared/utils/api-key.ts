import crypto from "crypto";

export interface ApiKeyPair {
  accessKeyId: string;
  secretKey: string;
  hashedSecret: string;
}

export const generateApiKey = (): ApiKeyPair => {
  const accessKeyId = `bfa_${crypto.randomBytes(16).toString("hex")}`;
  const secretKey = crypto.randomBytes(32).toString("hex");
  const hashedSecret = crypto.createHash("sha256").update(secretKey).digest("hex");

  return {
    accessKeyId,
    secretKey,
    hashedSecret,
  };
};

export const verifyApiKeySecret = (secretKey: string, hashedSecret: string): boolean => {
  const providedHash = crypto.createHash("sha256").update(secretKey).digest("hex");
  return providedHash === hashedSecret;
};

