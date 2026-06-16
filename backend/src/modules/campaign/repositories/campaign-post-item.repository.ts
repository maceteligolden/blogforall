import { injectable } from "tsyringe";
import CampaignPostItemModel, {
  CampaignPostItem,
} from "../../../shared/schemas/campaign-post-item.schema";

@injectable()
export class CampaignPostItemRepository {
  async create(data: Partial<CampaignPostItem>): Promise<CampaignPostItem> {
    const doc = new CampaignPostItemModel(data);
    return doc.save();
  }

  async createMany(items: Partial<CampaignPostItem>[]): Promise<CampaignPostItem[]> {
    const docs = await CampaignPostItemModel.insertMany(items);
    return docs as CampaignPostItem[];
  }

  async findByCampaign(campaignId: string, siteId: string): Promise<CampaignPostItem[]> {
    return CampaignPostItemModel.find({ campaign_id: campaignId, site_id: siteId }).sort({
      sequence_index: 1,
    });
  }

  async findById(id: string, siteId: string): Promise<CampaignPostItem | null> {
    return CampaignPostItemModel.findOne({ _id: id, site_id: siteId });
  }

  async findByBlogId(blogId: string, siteId: string): Promise<CampaignPostItem[]> {
    return CampaignPostItemModel.find({ blog_id: blogId, site_id: siteId });
  }

  async update(
    id: string,
    siteId: string,
    data: Partial<CampaignPostItem>
  ): Promise<CampaignPostItem | null> {
    return CampaignPostItemModel.findOneAndUpdate(
      { _id: id, site_id: siteId },
      { $set: { ...data, updated_at: new Date() } },
      { new: true }
    );
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const r = await CampaignPostItemModel.deleteOne({ _id: id, site_id: siteId });
    return r.deletedCount > 0;
  }

  async deleteByCampaign(campaignId: string, siteId: string): Promise<void> {
    await CampaignPostItemModel.deleteMany({ campaign_id: campaignId, site_id: siteId });
  }
}
