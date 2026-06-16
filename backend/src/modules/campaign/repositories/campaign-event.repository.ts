import { injectable } from "tsyringe";
import CampaignEventModel, { CampaignEvent } from "../../../shared/schemas/campaign-event.schema";
import { CampaignEventType } from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignEventRepository {
  async append(event: {
    campaign_id: string;
    site_id: string;
    type: CampaignEventType;
    payload?: Record<string, unknown>;
    actor_user_id?: string;
  }): Promise<CampaignEvent> {
    const doc = new CampaignEventModel({ ...event, created_at: new Date() });
    return doc.save();
  }

  async listByCampaign(campaignId: string, limit = 50): Promise<CampaignEvent[]> {
    return CampaignEventModel.find({ campaign_id: campaignId })
      .sort({ created_at: -1 })
      .limit(limit);
  }
}
