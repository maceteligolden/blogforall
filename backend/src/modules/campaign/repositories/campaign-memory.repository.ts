import { injectable } from "tsyringe";
import CampaignMemoryModel, { CampaignMemory } from "../../../shared/schemas/campaign-memory.schema";

@injectable()
export class CampaignMemoryRepository {
  async ensureForCampaign(campaignId: string, siteId: string): Promise<CampaignMemory> {
    let mem = await CampaignMemoryModel.findOne({ campaign_id: campaignId });
    if (!mem) {
      mem = await new CampaignMemoryModel({
        campaign_id: campaignId,
        site_id: siteId,
        summary: "",
        version: 1,
      }).save();
    }
    return mem;
  }

  async update(campaignId: string, patch: Partial<CampaignMemory>): Promise<CampaignMemory | null> {
    return CampaignMemoryModel.findOneAndUpdate(
      { campaign_id: campaignId },
      { $set: { ...patch, updated_at: new Date() }, $inc: { version: 1 } },
      { new: true }
    );
  }
}
