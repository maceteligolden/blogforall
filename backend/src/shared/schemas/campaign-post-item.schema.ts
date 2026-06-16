import { Schema, model } from "mongoose";
import { CampaignPostItemStatus } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignPostItem extends BaseEntity {
  campaign_id: string;
  site_id: string;
  sequence_index: number;
  title: string;
  objective: string;
  strategic_intent: string;
  target_keywords: string[];
  content_angle?: string;
  narrative_phase?: string;
  status: CampaignPostItemStatus;
  scheduled_at?: Date;
  timezone: string;
  blog_id?: string;
  scheduled_post_id?: string;
  generated_by: "ai" | "user";
  manually_added: boolean;
  locked: boolean;
  dependencies: string[];
  created_at: Date;
  updated_at: Date;
}

const campaignPostItemSchema = new Schema<CampaignPostItem>(
  {
    campaign_id: { type: String, required: true, index: true },
    site_id: { type: String, required: true, index: true },
    sequence_index: { type: Number, required: true, default: 0 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    objective: { type: String, required: true, maxlength: 1000 },
    strategic_intent: { type: String, required: true, maxlength: 1000 },
    target_keywords: { type: [String], default: [] },
    content_angle: { type: String, maxlength: 500 },
    narrative_phase: { type: String, maxlength: 100 },
    status: {
      type: String,
      enum: Object.values(CampaignPostItemStatus),
      default: CampaignPostItemStatus.PLANNED,
      index: true,
    },
    scheduled_at: { type: Date },
    timezone: { type: String, default: "UTC" },
    blog_id: { type: String, ref: "Blog" },
    scheduled_post_id: { type: String, ref: "ScheduledPost" },
    generated_by: { type: String, enum: ["ai", "user"], default: "ai" },
    manually_added: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    dependencies: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

campaignPostItemSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

campaignPostItemSchema.index({ campaign_id: 1, sequence_index: 1 });
campaignPostItemSchema.index({ campaign_id: 1, status: 1 });

export default model<CampaignPostItem>("CampaignPostItem", campaignPostItemSchema);
