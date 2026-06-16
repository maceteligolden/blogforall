import crypto from "crypto";
import { env } from "../config/env";

function getKey32(): Buffer {
  const explicit = env.workspaceCrypto.apiKeyEncryptionKey;
  if (explicit && explicit.length >= 32) {
    return crypto.createHash("sha256").update(explicit, "utf8").digest();
  }
  const access = env.jwt.accessSecret;
  if (!access) {
    throw new Error("WORKSPACE_API_KEY_ENCRYPTION_KEY or ACCESS_SECRET is required for API key secret storage");
  }
  return crypto.createHash("sha256").update(`workspace-api-key|${access}`, "utf8").digest();
}

/** AES-256-GCM; output base64(iv + ciphertext + tag). */
export function encryptWorkspaceApiKeySecret(plainSecret: string): string {
  const key = getKey32();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString("base64");
}

export function decryptWorkspaceApiKeySecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(raw.length - 16);
  const enc = raw.subarray(12, raw.length - 16);
  const key = getKey32();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
