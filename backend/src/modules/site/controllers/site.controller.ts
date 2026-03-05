import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteService } from "../services/site.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { CreateSiteInput, UpdateSiteInput } from "../validations/site.validation";

@injectable()
export class SiteController {
  constructor(private siteService: SiteService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const body = req.validatedBody as CreateSiteInput;
      const site = await this.siteService.createSite(userId, body);
      sendCreated(res, "Site created successfully", site);
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
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
      const userId = req.user!.userId;
      const { id } = req.validatedParams as { id: string };
      const site = await this.siteService.getSiteById(id, userId);
      sendSuccess(res, "Site retrieved successfully", site);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.validatedParams as { id: string };
      const body = req.validatedBody as UpdateSiteInput;
      const site = await this.siteService.updateSite(id, userId, body);
      sendSuccess(res, "Site updated successfully", site);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.validatedParams as { id: string };
      await this.siteService.deleteSite(id, userId);
      sendNoContent(res, "Site deleted successfully");
    } catch (error) {
      next(error);
    }
  };
}
