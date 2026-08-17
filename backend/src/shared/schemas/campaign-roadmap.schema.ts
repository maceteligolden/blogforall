import { Schema, model } from "mongoose";
import { CampaignRoadmapStatus } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export const ROADMAP_POST_TYPES = [
  "article",
  "tutorial",
  "how_to",
  "listicle",
  "opinion",
  "case_study",
  "definitive_guide",
  "software_roundup",
  "comparison",
  "thought_leadership",
] as const;

export type RoadmapPostType = (typeof ROADMAP_POST_TYPES)[number];

export interface CampaignRoadmapItemSnapshot {
  title: string;
  objective: string;
  strategic_intent: string;
  sequence_index: number;
  narrative_phase?: string;
  scheduled_at?: Date;
  about?: string;
  keywords?: string[];
  post_type?: RoadmapPostType;
  campaign_support?: string;
  draft_status?: string;
  blog_id?: string;
  scheduled_post_id?: string;
}

export interface CampaignRoadmap extends BaseEntity {
  campaign_id: string;
  site_id: string;
  version: number;
  status: CampaignRoadmapStatus;
  generated_at: Date;
  generated_by: "ai" | "user";
  summary: string;
  narrative_arc: string;
  cadence_rationale: string;
  items: CampaignRoadmapItemSnapshot[];
  diversity_notes?: string;
  gap_analysis?: string;
  research_package_id?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

const roadmapItemSchema = new Schema<CampaignRoadmapItemSnapshot>(
  {
    title: { type: String, required: true },
    objective: { type: String, default: "" },
    strategic_intent: { type: String, default: "" },
    sequence_index: { type: Number, required: true },
    narrative_phase: { type: String },
    scheduled_at: { type: Date },
    about: { type: String },
    keywords: { type: [String], default: undefined },
    post_type: { type: String },
    campaign_support: { type: String },
  },
  { _id: false }
);

const campaignRoadmapSchema = new Schema<CampaignRoadmap>(
  {
    campaign_id: { type: String, required: true, index: true },
    site_id: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: Object.values(CampaignRoadmapStatus),
      default: CampaignRoadmapStatus.DRAFT,
      index: true,
    },
    generated_at: { type: Date, default: Date.now },
    generated_by: { type: String, enum: ["ai", "user"], default: "ai" },
    summary: { type: String, default: "" },
    narrative_arc: { type: String, default: "" },
    cadence_rationale: { type: String, default: "" },
    items: { type: [roadmapItemSchema], default: [] },
    diversity_notes: { type: String },
    gap_analysis: { type: String },
    research_package_id: { type: String },
    rejection_reason: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

campaignRoadmapSchema.index({ campaign_id: 1, version: 1 }, { unique: true });

export default model<CampaignRoadmap>("CampaignRoadmap", campaignRoadmapSchema);
