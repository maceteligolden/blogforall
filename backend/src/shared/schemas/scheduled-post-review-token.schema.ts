import { BaseEntity } from "../interfaces";

export enum ReviewTokenAction {
  APPROVED = "approved",
  REWORK_REQUESTED = "rework_requested",
}

export interface ScheduledPostReviewToken extends BaseEntity {
  site_id: string;
  scheduled_post_id: string;
  user_id: string;
  token_lookup: string;
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
  used_action?: ReviewTokenAction;
  rework_round: number;
  created_at: Date;
  updated_at: Date;
}
