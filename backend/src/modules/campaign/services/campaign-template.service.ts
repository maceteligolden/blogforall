import { injectable } from "tsyringe";
import { CampaignTemplateRepository } from "../repositories/campaign-template.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateCampaignTemplateInput, UpdateCampaignTemplateInput, CampaignTemplateQueryFilters } from "../interfaces/campaign-template.interface";
import { CampaignTemplate, CampaignTemplate as CampaignTemplateType } from "../../../shared/schemas/campaign-template.schema";

@injectable()
export class CampaignTemplateService {
  constructor(private templateRepository: CampaignTemplateRepository) {}

  async createTemplate(input: CreateCampaignTemplateInput): Promise<CampaignTemplate> {
    // Validate duration
    if (input.default_duration_days < 1 || input.default_duration_days > 365) {
      throw new BadRequestError("Duration must be between 1 and 365 days");
    }

    // Validate posts count
    if (input.default_posts_count < 1) {
      throw new BadRequestError("Posts count must be at least 1");
    }

    const template = await this.templateRepository.create({
      ...input,
      is_active: true,
    });

    logger.info("Campaign template created", { templateId: template._id }, "CampaignTemplateService");
    return template;
  }

  async getTemplateById(templateId: string): Promise<CampaignTemplate> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new NotFoundError("Campaign template not found");
    }
    return template;
  }

  async getTemplates(filters?: CampaignTemplateQueryFilters): Promise<CampaignTemplate[]> {
    return this.templateRepository.findAll(filters);
  }

  async getTemplatesByType(type: string): Promise<CampaignTemplate[]> {
    return this.templateRepository.findByType(type as any);
  }

  async updateTemplate(
    templateId: string,
    input: UpdateCampaignTemplateInput
  ): Promise<CampaignTemplate> {
    const template = await this.getTemplateById(templateId);

    // Validate duration if updating
    if (input.default_duration_days !== undefined) {
      if (input.default_duration_days < 1 || input.default_duration_days > 365) {
        throw new BadRequestError("Duration must be between 1 and 365 days");
      }
    }

    // Validate posts count if updating
    if (input.default_posts_count !== undefined) {
      if (input.default_posts_count < 1) {
        throw new BadRequestError("Posts count must be at least 1");
      }
    }

    const updatedTemplate = await this.templateRepository.update(templateId, input);
    if (!updatedTemplate) {
      throw new NotFoundError("Campaign template not found");
    }

    logger.info("Campaign template updated", { templateId }, "CampaignTemplateService");
    return updatedTemplate;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const template = await this.getTemplateById(templateId);
    
    // Soft delete by marking as inactive
    await this.templateRepository.update(templateId, { is_active: false });

    logger.info("Campaign template deleted (deactivated)", { templateId }, "CampaignTemplateService");
  }

  async activateTemplate(templateId: string): Promise<CampaignTemplate> {
    return this.updateTemplate(templateId, { is_active: true });
  }

  async deactivateTemplate(templateId: string): Promise<CampaignTemplate> {
    return this.updateTemplate(templateId, { is_active: false });
  }
}
