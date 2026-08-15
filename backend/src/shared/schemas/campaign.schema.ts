import {
  CampaignStatus,
  PostFrequency,
  CampaignType,
  CampaignLifecycleStatus,
  CampaignHealthStatus,
  CampaignContentAutonomy,
  CampaignPublishingMode,
  CampaignApprovalPolicy,
} from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignIntelligenceSnapshot {
  knowledge_gaps: string[];
  funnel_coverage: { awareness: number; consideration: number; conversion: number };
  unverified_assumptions: string[];
  next_questions: string[];
  progress_pct: number;
  success_probability: number;
  recommended_actions: string[];
  dimensions: {
    knowledge_completeness: number;
    audience_understanding: number;
    messaging_confidence: number;
    funnel_coverage: number;
    content_diversity: number;
    conversion_readiness: number;
    overall_confidence: number;
  };
  computed_at?: Date;
}

export interface Campaign extends BaseEntity {
  user_id: string;
  site_id: string;
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  status: CampaignStatus;
  lifecycle_status?: CampaignLifecycleStatus;
  campaign_type?: CampaignType;
  health_status?: CampaignHealthStatus;
  health_computed_at?: Date;
  health_reasons?: string[];
  is_default?: boolean;
  strategy_id?: string;
  messaging?: string;
  desired_transformation?: string;
  funnel_focus?: "awareness" | "consideration" | "conversion" | "full_funnel";
  guardrails?: string[];
  assumptions?: string[];
  hypotheses?: string[];
  related_products?: string[];
  supporting_evidence?: string[];
  intelligence?: CampaignIntelligenceSnapshot;
  content_autonomy?: CampaignContentAutonomy;
  publishing_mode?: CampaignPublishingMode;
  approval_policy?: CampaignApprovalPolicy;
  primary_topics?: string[];
  cta_strategy?: {
    primary_cta?: string;
    secondary_cta?: string;
  };
  notifications?: {
    daily_progress_email?: boolean;
  };
  start_date: Date;
  end_date: Date;
  posting_frequency: PostFrequency;
  custom_schedule?: string;
  timezone: string;
  total_posts_planned?: number;
  posts_published: number;
  budget?: number;
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[];
  };
  ai_strategy?: {
    content_themes?: string[];
    suggested_topics?: string[];
    optimal_times?: string[];
  };
  template_id?: string;
  created_at: Date;
  updated_at: Date;
}

export function legacyStatusToLifecycle(status: CampaignStatus): CampaignLifecycleStatus {
  switch (status) {
    case CampaignStatus.ACTIVE:
      return CampaignLifecycleStatus.ACTIVE;
    case CampaignStatus.PAUSED:
      return CampaignLifecycleStatus.PAUSED;
    case CampaignStatus.COMPLETED:
      return CampaignLifecycleStatus.COMPLETED;
    case CampaignStatus.CANCELLED:
      return CampaignLifecycleStatus.ARCHIVED;
    default:
      return CampaignLifecycleStatus.DRAFT;
  }
}
