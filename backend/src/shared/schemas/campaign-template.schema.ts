import { CampaignTemplateType, PostFrequency } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignTemplate extends BaseEntity {
  name: string;
  description: string;
  type: CampaignTemplateType;
  default_goal: string;
  default_duration_days: number;
  default_frequency: PostFrequency;
  default_posts_count: number;
  suggested_topics: string[];
  content_themes: string[];
  ai_prompts: {
    campaign_strategy?: string;
    post_generation?: string;
  };
  metadata?: {
    best_for?: string[];
    industries?: string[];
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
