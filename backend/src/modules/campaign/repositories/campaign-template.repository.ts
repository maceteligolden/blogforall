import { injectable } from "tsyringe";
import CampaignTemplate, {
  CampaignTemplate as CampaignTemplateType,
} from "../../../shared/schemas/campaign-template.schema";
import { CampaignTemplateType as TemplateType } from "../../../shared/constants/campaign.constant";
import { CampaignTemplateQueryFilters } from "../interfaces/campaign-template.interface";

@injectable()
export class CampaignTemplateRepository {
  async create(templateData: Partial<CampaignTemplateType>): Promise<CampaignTemplateType> {
    const template = new CampaignTemplate(templateData);
    return template.save();
  }

  async findById(id: string): Promise<CampaignTemplateType | null> {
    return CampaignTemplate.findById(id);
  }

  async findAll(filters?: CampaignTemplateQueryFilters): Promise<CampaignTemplateType[]> {
    const query: Record<string, unknown> = {};

    if (filters?.type) {
      query.type = filters.type;
    }
    if (filters?.is_active !== undefined) {
      query.is_active = filters.is_active;
    } else {
      // Default to active templates only
      query.is_active = true;
    }
    if (filters?.industry) {
      query["metadata.industries"] = filters.industry;
    }

    return CampaignTemplate.find(query).sort({ name: 1 });
  }

  async findByType(type: TemplateType): Promise<CampaignTemplateType[]> {
    return CampaignTemplate.find({ type, is_active: true }).sort({ name: 1 });
  }

  async update(id: string, updateData: Partial<CampaignTemplateType>): Promise<CampaignTemplateType | null> {
    return CampaignTemplate.findByIdAndUpdate(id, { $set: updateData }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await CampaignTemplate.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }
}
