import { createHash, randomUUID } from "crypto";
import path from "path";
import { DeleteObjectCommand, PutBucketAclCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { injectable, singleton } from "tsyringe";
import { env } from "../config/env";
import { HttpStatus } from "../constants";
import { AppError } from "../errors";
import { logger } from "../utils/logger";

function encodeObjectKeyForUrl(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function pickExtension(originalName: string, mimetype: string): string {
  const ext = path.extname(originalName).toLowerCase();
  if (ext.length > 0 && ext.length <= 8) {
    return ext;
  }
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
  };
  return map[mimetype] || ".bin";
}

export type PutSiteImageInput = {
  siteId: string;
  buffer: Buffer;
  contentType: string;
  originalName: string;
};

export type PutSiteImageResult = {
  objectKey: string;
  publicUrl: string;
  filename: string;
  sha256: string;
};

@singleton()
@injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null;

  constructor() {
    const os = env.objectStorage;
    this.client = os.enabled
      ? new S3Client({
          region: os.region,
          endpoint: os.s3Endpoint,
          credentials: {
            accessKeyId: os.keyId,
            secretAccessKey: os.applicationKey,
          },
          forcePathStyle: true,
        })
      : null;
  }

  get enabled(): boolean {
    return env.objectStorage.enabled;
  }

  /** Sets bucket ACL to public-read so `/file/{bucket}/...` URLs work without auth. App key needs writeBuckets + writeBucketSettings (or equivalent). */
  async applyBucketPublicReadAcl(): Promise<void> {
    if (!this.client || !env.objectStorage.enabled) {
      return;
    }
    try {
      await this.client.send(
        new PutBucketAclCommand({
          Bucket: env.objectStorage.bucket,
          ACL: "public-read",
        })
      );
      logger.info("B2 bucket ACL set to public-read", { bucket: env.objectStorage.bucket }, "ObjectStorageService");
    } catch (err) {
      logger.warn(
        "B2 PutBucketAcl public-read failed; set the bucket to Public in the Backblaze UI or widen application key capabilities",
        { bucket: env.objectStorage.bucket, error: err instanceof Error ? err.message : String(err) },
        "ObjectStorageService"
      );
    }
  }

  buildPublicUrl(objectKey: string): string {
    const base = env.objectStorage.publicBaseUrl.replace(/\/+$/, "");
    return `${base}/${encodeObjectKeyForUrl(objectKey)}`;
  }

  async putSiteImage(input: PutSiteImageInput): Promise<PutSiteImageResult> {
    if (!this.client || !env.objectStorage.enabled) {
      throw new AppError("Object storage is not configured", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const ext = pickExtension(input.originalName, input.contentType);
    const assetId = randomUUID();
    const objectKey = `site/${input.siteId}/images/${assetId}${ext}`;
    const sha256 = createHash("sha256").update(input.buffer).digest("hex");
    const filename = `${assetId}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: env.objectStorage.bucket,
          Key: objectKey,
          Body: input.buffer,
          ContentType: input.contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      throw new AppError(`Failed to store image: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const publicUrl = this.buildPublicUrl(objectKey);

    return {
      objectKey,
      publicUrl,
      filename,
      sha256,
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    if (!this.client || !env.objectStorage.enabled) {
      return;
    }
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: env.objectStorage.bucket,
        Key: objectKey,
      })
    );
  }
}
