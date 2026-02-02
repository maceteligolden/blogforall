import { CampaignTemplateType, PostFrequency } from "../../../shared/constants/campaign.constant";

export interface CreateCampaignTemplateInput {
  name: string;
  description: string;
  type: CampaignTemplateType;
  default_goal: string;
  default_duration_days: number;
  default_frequency: PostFrequency;
  default_posts_count: number;
  suggested_topics?: string[];
  content_themes?: string[];
  ai_prompts?: {
    campaign_strategy?: string;
    post_generation?: string;
  };
  metadata?: {
    best_for?: string[];
    industries?: string[];
  };
}

export interface UpdateCampaignTemplateInput {
  name?: string;
  description?: string;
  default_goal?: string;
  default_duration_days?: number;
  default_frequency?: PostFrequency;
  default_posts_count?: number;
  suggested_topics?: string[];
  content_themes?: string[];
  ai_prompts?: {
    campaign_strategy?: string;
    post_generation?: string;
  };
  metadata?: {
    best_for?: string[];
    industries?: string[];
  };
  is_active?: boolean;
}

export interface CampaignTemplateQueryFilters {
  type?: CampaignTemplateType;
  is_active?: boolean;
  industry?: string;
}
