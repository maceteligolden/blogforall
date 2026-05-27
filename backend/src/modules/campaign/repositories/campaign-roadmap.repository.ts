import { injectable } from "tsyringe";
import CampaignRoadmapModel, { CampaignRoadmap } from "../../../shared/schemas/campaign-roadmap.schema";
import { CampaignRoadmapStatus } from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignRoadmapRepository {
  async create(data: Partial<CampaignRoadmap>): Promise<CampaignRoadmap> {
    const doc = new CampaignRoadmapModel(data);
    return doc.save();
  }

  async findLatest(campaignId: string, siteId: string): Promise<CampaignRoadmap | null> {
    return CampaignRoadmapModel.findOne({ campaign_id: campaignId, site_id: siteId }).sort({
      version: -1,
    });
  }

  async findByVersion(
    campaignId: string,
    siteId: string,
    version: number
  ): Promise<CampaignRoadmap | null> {
    return CampaignRoadmapModel.findOne({ campaign_id: campaignId, site_id: siteId, version });
  }

  async listVersions(campaignId: string, siteId: string): Promise<CampaignRoadmap[]> {
    return CampaignRoadmapModel.find({ campaign_id: campaignId, site_id: siteId }).sort({
      version: -1,
    });
  }

  async updateStatus(
    id: string,
    siteId: string,
    status: CampaignRoadmapStatus,
    extra?: Partial<CampaignRoadmap>
  ): Promise<CampaignRoadmap | null> {
    return CampaignRoadmapModel.findOneAndUpdate(
      { _id: id, site_id: siteId },
      { $set: { status, updated_at: new Date(), ...extra } },
      { new: true }
    );
  }

  async nextVersion(campaignId: string, siteId: string): Promise<number> {
    const latest = await this.findLatest(campaignId, siteId);
    return (latest?.version ?? 0) + 1;
  }
}
