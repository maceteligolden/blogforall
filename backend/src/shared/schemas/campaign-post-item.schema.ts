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
