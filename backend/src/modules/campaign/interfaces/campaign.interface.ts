import { CampaignLifecycleStatus, CampaignStatus, PostFrequency } from "../../../shared/constants/campaign.constant";

export interface CreateCampaignInput {
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  desired_transformation?: string;
  messaging?: string;
  funnel_focus?: "awareness" | "consideration" | "conversion" | "full_funnel";
  cta_strategy?: {
    primary_cta?: string;
    secondary_cta?: string;
  };
  start_date: Date;
  end_date: Date;
  posting_frequency: PostFrequency;
  custom_schedule?: string; // Cron expression
  timezone?: string;
  total_posts_planned?: number;
  budget?: number;
  strategy_id?: string;
  primary_topics?: string[];
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[];
  };
  template_id?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  goal?: string;
  target_audience?: string;
  desired_transformation?: string;
  messaging?: string;
  funnel_focus?: "awareness" | "consideration" | "conversion" | "full_funnel";
  cta_strategy?: {
    primary_cta?: string;
    secondary_cta?: string;
  };
  start_date?: Date;
  end_date?: Date;
  posting_frequency?: PostFrequency;
  custom_schedule?: string;
  timezone?: string;
  total_posts_planned?: number;
  budget?: number;
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[];
  };
  status?: CampaignStatus;
  lifecycle_status?: CampaignLifecycleStatus;
  primary_topics?: string[];
}

export interface CampaignQueryFilters {
  status?: CampaignStatus;
  search?: string;
  start_date_from?: Date;
  start_date_to?: Date;
  page?: number;
  limit?: number;
}

export interface CampaignWithStats {
  _id: string;
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  status: CampaignStatus;
  start_date: Date;
  end_date: Date;
  posting_frequency: PostFrequency;
  timezone: string;
  total_posts_planned?: number;
  posts_published: number;
  posts_scheduled: number;
  posts_pending: number;
  created_at: Date;
  updated_at: Date;
}
