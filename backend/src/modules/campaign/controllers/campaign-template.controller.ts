import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { CampaignTemplateService } from "../services/campaign-template.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import type {
  CreateCampaignTemplateInput,
  UpdateCampaignTemplateInput,
  CampaignTemplateQueryFilters,
} from "../interfaces/campaign-template.interface";

@injectable()
export class CampaignTemplateController {
  constructor(private templateService: CampaignTemplateService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.validatedBody as CreateCampaignTemplateInput;
      const template = await this.templateService.createTemplate(body);
      sendCreated(res, "Campaign template created successfully", template);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const template = await this.templateService.getTemplateById(id);
      sendSuccess(res, "Campaign template retrieved successfully", template);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = req.validatedQuery as CampaignTemplateQueryFilters;
      const templates = await this.templateService.getTemplates(filters);
      sendSuccess(res, "Campaign templates retrieved successfully", templates);
    } catch (error) {
      next(error);
    }
  };

  getByType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.validatedParams as { siteId: string; type: string };
      const templates = await this.templateService.getTemplatesByType(type);
      sendSuccess(res, "Campaign templates retrieved successfully", templates);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const body = req.validatedBody as UpdateCampaignTemplateInput;
      const template = await this.templateService.updateTemplate(id, body);
      sendSuccess(res, "Campaign template updated successfully", template);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      await this.templateService.deleteTemplate(id);
      sendNoContent(res, "Campaign template deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const template = await this.templateService.activateTemplate(id);
      sendSuccess(res, "Campaign template activated successfully", template);
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.validatedParams as { siteId: string; id: string };
      const template = await this.templateService.deactivateTemplate(id);
      sendSuccess(res, "Campaign template deactivated successfully", template);
    } catch (error) {
      next(error);
    }
  };
}
