import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignTemplateService } from "../services/campaign-template.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { CampaignTemplateQueryFilters } from "../interfaces/campaign-template.interface";
import { CampaignTemplateType } from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignTemplateController {
  constructor(private templateService: CampaignTemplateService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const template = await this.templateService.createTemplate(req.body);
      sendCreated(res, "Campaign template created successfully", template);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await this.templateService.getTemplateById(id);
      sendSuccess(res, "Campaign template retrieved successfully", template);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters: CampaignTemplateQueryFilters = {
        type: req.query.type as CampaignTemplateType | undefined,
        is_active: req.query.is_active === "true" ? true : req.query.is_active === "false" ? false : undefined,
        industry: req.query.industry as string | undefined,
      };

      const templates = await this.templateService.getTemplates(filters);
      sendSuccess(res, "Campaign templates retrieved successfully", templates);
    } catch (error) {
      next(error);
    }
  };

  getByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.params;
      const templates = await this.templateService.getTemplatesByType(type);
      sendSuccess(res, "Campaign templates retrieved successfully", templates);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await this.templateService.updateTemplate(id, req.body);
      sendSuccess(res, "Campaign template updated successfully", template);
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
      const { id } = req.params;
      await this.templateService.deleteTemplate(id);
      sendNoContent(res, "Campaign template deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await this.templateService.activateTemplate(id);
      sendSuccess(res, "Campaign template activated successfully", template);
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const template = await this.templateService.deactivateTemplate(id);
      sendSuccess(res, "Campaign template deactivated successfully", template);
    } catch (error) {
      next(error);
    }
  };
}
