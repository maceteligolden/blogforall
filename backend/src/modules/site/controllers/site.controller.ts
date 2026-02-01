import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteService } from "../services/site.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createSiteSchema, updateSiteSchema } from "../validations/site.validation";

@injectable()
export class SiteController {
  constructor(private siteService: SiteService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const validatedData = createSiteSchema.parse(req.body);
      const site = await this.siteService.createSite(userId, validatedData);
      sendCreated(res, "Site created successfully", site);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const includeMembers = req.query.include_members === "true";
      
      if (includeMembers) {
        const sites = await this.siteService.getSitesWithMembers(userId);
        sendSuccess(res, "Sites retrieved successfully", sites);
      } else {
        const sites = await this.siteService.getSitesByUser(userId);
        sendSuccess(res, "Sites retrieved successfully", sites);
      }
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      const site = await this.siteService.getSiteById(id, userId);
      sendSuccess(res, "Site retrieved successfully", site);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      const validatedData = updateSiteSchema.parse(req.body);
      const site = await this.siteService.updateSite(id, userId, validatedData);
      sendSuccess(res, "Site updated successfully", site);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id } = req.params;
      await this.siteService.deleteSite(id, userId);
      sendNoContent(res, "Site deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}
