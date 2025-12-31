import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendCreated } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import path from "path";

@injectable()
export class ImageController {
  uploadSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        return next(new BadRequestError("No image file provided"));
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      sendCreated(res, "Image uploaded successfully", { url: imageUrl, filename: req.file.filename });
    } catch (error) {
      next(error);
    }
  };

  uploadMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return next(new BadRequestError("No image files provided"));
      }

      const files = Array.isArray(req.files) ? req.files : [req.files];
      const imageUrls = files.map((file) => ({
        url: `/uploads/${file.filename}`,
        filename: file.filename,
      }));

      sendCreated(res, "Images uploaded successfully", { images: imageUrls });
    } catch (error) {
      next(error);
    }
  };
}

