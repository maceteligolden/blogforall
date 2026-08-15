import { ScheduledPostStatus } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface ScheduledPost extends BaseEntity {
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
    campaign_post_item_id?: string;
  };
  prepared_at?: Date;
  approved_at?: Date;
  approved_by_user_id?: string;
  rework_comments?: string;
  rework_round: number;
  created_at: Date;
  updated_at: Date;
}
