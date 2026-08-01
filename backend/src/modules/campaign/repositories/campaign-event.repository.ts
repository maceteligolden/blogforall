import { injectable } from "tsyringe";
import CampaignEventModel, { CampaignEvent } from "../../../shared/schemas/campaign-event.schema";
import { CampaignEventType } from "../../../shared/constants/campaign.constant";
import { RealtimeService, REALTIME_EVENTS } from "../../../shared/realtime";

@injectable()
export class CampaignEventRepository {
  constructor(private readonly realtimeService: RealtimeService) {}

  async append(event: {
    campaign_id: string;
    site_id: string;
    type: CampaignEventType;
    payload?: Record<string, unknown>;
    actor_user_id?: string;
  }): Promise<CampaignEvent> {
    const doc = new CampaignEventModel({ ...event, created_at: new Date() });
    const saved = await doc.save();

    this.realtimeService.emitToSite(
      event.site_id,
      REALTIME_EVENTS.CAMPAIGN_EVENT_APPENDED,
      {
        id: String(saved._id),
        campaignId: event.campaign_id,
        siteId: event.site_id,
        type: event.type,
        payload: event.payload ?? {},
        actorUserId: event.actor_user_id,
        createdAt: (saved.created_at ?? new Date()).toISOString(),
      },
      { siteId: event.site_id }
    );

    return saved;
  }

  async listByCampaign(campaignId: string, limit = 50): Promise<CampaignEvent[]> {
    return CampaignEventModel.find({ campaign_id: campaignId }).sort({ created_at: -1 }).limit(limit);
  }
}
