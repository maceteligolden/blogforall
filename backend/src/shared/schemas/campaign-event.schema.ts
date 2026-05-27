import { Schema, model } from "mongoose";
import { CampaignEventType } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignEvent extends BaseEntity {
  campaign_id: string;
  site_id: string;
  type: CampaignEventType;
  payload?: Record<string, unknown>;
  actor_user_id?: string;
  created_at: Date;
}

const campaignEventSchema = new Schema<CampaignEvent>(
  {
    campaign_id: { type: String, required: true, index: true },
    site_id: { type: String, required: true, index: true },
    type: { type: String, enum: Object.values(CampaignEventType), required: true, index: true },
    payload: { type: Schema.Types.Mixed },
    actor_user_id: { type: String },
    created_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

campaignEventSchema.index({ campaign_id: 1, created_at: -1 });

export default model<CampaignEvent>("CampaignEvent", campaignEventSchema);
