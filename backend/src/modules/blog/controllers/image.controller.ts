import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendCreated } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";
import { ObjectStorageService } from "../../../shared/services/object-storage.service";

@injectable()
export class ImageController {
  constructor(private readonly objectStorage: ObjectStorageService) {}

  private siteId(req: Request): string {
    const p = req.validatedParams as { siteId?: string } | undefined;
    if (!p?.siteId) {
      throw new BadRequestError("Missing site context");
    }
    return p.siteId;
  }

  uploadSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        logger.warn("Image upload failed: No file provided", {}, "ImageController");
        return next(new BadRequestError("No image file provided"));
      }

      if (this.objectStorage.enabled && file.buffer && file.buffer.length > 0) {
        const siteId = this.siteId(req);
        const { publicUrl, filename } = await this.objectStorage.putSiteImage({
          siteId,
          buffer: file.buffer,
          contentType: file.mimetype,
          originalName: file.originalname,
        });
        logger.info("Image uploaded to object storage", { filename, url: publicUrl }, "ImageController");
        sendCreated(res, "Image uploaded successfully", { url: publicUrl, filename });
        return;
      }

      const baseUrl = env.backendUrl || `http://localhost:${env.port}`;
      const imageUrl = `${baseUrl}/uploads/${file.filename}`;

      logger.info("Image uploaded successfully", { filename: file.filename, url: imageUrl }, "ImageController");
      sendCreated(res, "Image uploaded successfully", { url: imageUrl, filename: file.filename });
    } catch (error) {
      logger.error("Image upload error", error as Error, {}, "ImageController");
      next(error);
    }
  };

  uploadMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        logger.warn("Multiple image upload failed: No files provided", {}, "ImageController");
        return next(new BadRequestError("No image files provided"));
      }

      const files = req.files;

      if (this.objectStorage.enabled) {
        const siteId = this.siteId(req);
        const imageUrls = await Promise.all(
          files.map(async (f) => {
            if (!f.buffer?.length) {
              throw new BadRequestError("Invalid upload payload");
            }
            const { publicUrl, filename } = await this.objectStorage.putSiteImage({
              siteId,
              buffer: f.buffer,
              contentType: f.mimetype,
              originalName: f.originalname,
            });
            return { url: publicUrl, filename };
          })
        );
        logger.info("Multiple images uploaded to object storage", { count: files.length }, "ImageController");
        sendCreated(res, "Images uploaded successfully", { images: imageUrls });
        return;
      }

      const baseUrl = env.backendUrl || `http://localhost:${env.port}`;
      const imageUrls = files.map((f) => ({
        url: `${baseUrl}/uploads/${f.filename}`,
        filename: f.filename,
      }));

      logger.info("Multiple images uploaded successfully", { count: files.length }, "ImageController");
      sendCreated(res, "Images uploaded successfully", { images: imageUrls });
    } catch (error) {
      logger.error("Multiple image upload error", error as Error, {}, "ImageController");
      next(error);
    }
  };
}
