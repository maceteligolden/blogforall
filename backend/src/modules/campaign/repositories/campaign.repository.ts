import { injectable } from "tsyringe";
import Campaign, { Campaign as CampaignType } from "../../../shared/schemas/campaign.schema";
import { CampaignStatus } from "../../../shared/constants/campaign.constant";
import { PaginationOptions, PaginatedResponse } from "../../../shared/interfaces";
import { CampaignQueryFilters } from "../interfaces/campaign.interface";

@injectable()
export class CampaignRepository {
  async create(campaignData: Partial<CampaignType>): Promise<CampaignType> {
    const campaign = new Campaign(campaignData);
    return campaign.save();
  }

  async findById(id: string, siteId?: string): Promise<CampaignType | null> {
    const query: Record<string, unknown> = { _id: id };
    if (siteId) {
      query.site_id = siteId;
    }
    return Campaign.findOne(query);
  }

  async findByUser(userId: string, siteId: string, filters?: CampaignQueryFilters): Promise<CampaignType[]> {
    const query: Record<string, unknown> = { user_id: userId, site_id: siteId };
    
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.start_date_from) {
      query.start_date = { ...query.start_date as Record<string, unknown>, $gte: filters.start_date_from };
    }
    if (filters?.start_date_to) {
      query.start_date = { ...query.start_date as Record<string, unknown>, $lte: filters.start_date_to };
    }
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { goal: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    return Campaign.find(query).sort({ created_at: -1 });
  }

  async findAll(siteId: string, filters?: CampaignQueryFilters): Promise<PaginatedResponse<CampaignType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { site_id: siteId };
    
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.start_date_from) {
      query.start_date = { ...(query.start_date as Record<string, unknown> || {}), $gte: filters.start_date_from };
    }
    if (filters?.start_date_to) {
      query.start_date = { ...(query.start_date as Record<string, unknown> || {}), $lte: filters.start_date_to };
    }
    if (filters?.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { goal: { $regex: filters.search, $options: "i" } },
        { description: { $regex: filters.search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      Campaign.find(query).sort({ created_at: -1 }).skip(skip).limit(limit),
      Campaign.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, siteId: string, updateData: Partial<CampaignType>): Promise<CampaignType | null> {
    return Campaign.findOneAndUpdate(
      { _id: id, site_id: siteId },
      { $set: updateData },
      { new: true }
    );
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const result = await Campaign.deleteOne({ _id: id, site_id: siteId });
    return result.deletedCount > 0;
  }

  async findActiveCampaigns(siteId?: string): Promise<CampaignType[]> {
    const query: Record<string, unknown> = {
      status: CampaignStatus.ACTIVE,
      start_date: { $lte: new Date() },
      end_date: { $gte: new Date() },
    };
    if (siteId) {
      query.site_id = siteId;
    }
    return Campaign.find(query).sort({ start_date: 1 });
  }

  async updatePostsPublished(campaignId: string, increment: number = 1): Promise<void> {
    await Campaign.updateOne(
      { _id: campaignId },
      { $inc: { posts_published: increment } }
    );
  }

  async findByDateRange(siteId: string, startDate: Date, endDate: Date): Promise<CampaignType[]> {
    return Campaign.find({
      site_id: siteId,
      $or: [
        { start_date: { $lte: endDate }, end_date: { $gte: startDate } },
      ],
    }).sort({ start_date: 1 });
  }
}
