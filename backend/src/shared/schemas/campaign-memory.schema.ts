import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface CampaignMemory extends BaseEntity {
  campaign_id: string;
  site_id: string;
  covered_topics: string[];
  rejected_topics: { topic: string; reason: string; at: Date }[];
  successful_angles: { angle: string; evidence?: string }[];
  audience_insights: string[];
  performance_patterns: string[];
  decisions: { decision: string; by: "user" | "ai"; at: Date }[];
  summary: string;
  version: number;
  updated_at: Date;
}

const campaignMemorySchema = new Schema<CampaignMemory>(
  {
    campaign_id: { type: String, required: true, unique: true, index: true },
    site_id: { type: String, required: true, index: true },
    covered_topics: { type: [String], default: [] },
    rejected_topics: {
      type: [
        {
          topic: String,
          reason: String,
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    successful_angles: {
      type: [{ angle: String, evidence: String }],
      default: [],
    },
    audience_insights: { type: [String], default: [] },
    performance_patterns: { type: [String], default: [] },
    decisions: {
      type: [
        {
          decision: String,
          by: { type: String, enum: ["user", "ai"] },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    summary: { type: String, default: "" },
    version: { type: Number, default: 1 },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default model<CampaignMemory>("CampaignMemory", campaignMemorySchema);
