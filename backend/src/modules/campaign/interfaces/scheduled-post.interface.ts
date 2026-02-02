import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";

export interface CreateScheduledPostInput {
  blog_id?: string; // Optional - can be null for auto-generated posts
  campaign_id?: string; // Optional - can be null for standalone posts
  title: string;
  scheduled_at: Date;
  timezone?: string;
  auto_generate?: boolean;
  generation_prompt?: string;
  metadata?: {
    campaign_goal?: string;
    target_audience?: string;
    content_theme?: string;
  };
}

export interface UpdateScheduledPostInput {
  blog_id?: string;
  title?: string;
  scheduled_at?: Date;
  timezone?: string;
  status?: ScheduledPostStatus;
  generation_prompt?: string;
  metadata?: {
    campaign_goal?: string;
    target_audience?: string;
    content_theme?: string;
  };
}

export interface ScheduledPostQueryFilters {
  campaign_id?: string;
  status?: ScheduledPostStatus;
  scheduled_at_from?: Date;
  scheduled_at_to?: Date;
  page?: number;
  limit?: number;
}

export interface ScheduledPostWithBlog {
  _id: string;
  user_id: string;
  site_id: string;
  blog_id?: string;
  campaign_id?: string;
  title: string;
  scheduled_at: Date;
  timezone: string;
  status: ScheduledPostStatus;
  publish_attempts: number;
  last_attempt_at?: Date;
  error_message?: string;
  published_at?: Date;
  auto_generate: boolean;
  generation_prompt?: string;
  metadata?: {
    campaign_goal?: string;
    target_audience?: string;
    content_theme?: string;
  };
  blog?: {
    _id: string;
    title: string;
    slug: string;
    status: string;
    excerpt?: string;
  };
  campaign?: {
    _id: string;
    name: string;
    goal: string;
  };
  created_at: Date;
  updated_at: Date;
}
