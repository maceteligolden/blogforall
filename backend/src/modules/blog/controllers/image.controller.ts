import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendCreated } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";

@injectable()
export class ImageController {
  uploadSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        logger.warn("Image upload failed: No file provided", {}, "ImageController");
        return next(new BadRequestError("No image file provided"));
      }

      // Return full URL for the uploaded image
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

      logger.info("Image uploaded successfully", { filename: req.file.filename, url: imageUrl }, "ImageController");
      sendCreated(res, "Image uploaded successfully", { url: imageUrl, filename: req.file.filename });
    } catch (error) {
      logger.error("Image upload error", error as Error, {}, "ImageController");
      next(error);
    }
  };

  uploadMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        logger.warn("Multiple image upload failed: No files provided", {}, "ImageController");
        return next(new BadRequestError("No image files provided"));
      }

      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
      const files = Array.isArray(req.files) ? req.files : [req.files];
      const imageUrls = files.map((file) => ({
        url: `${baseUrl}/uploads/${file.filename}`,
        filename: file.filename,
      }));

      logger.info("Multiple images uploaded successfully", { count: files.length }, "ImageController");
      sendCreated(res, "Images uploaded successfully", { images: imageUrls });
    } catch (error) {
      logger.error("Multiple image upload error", error as Error, {}, "ImageController");
      next(error);
    }
  };
}
