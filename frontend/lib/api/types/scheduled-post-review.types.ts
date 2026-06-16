export type ScheduledPostStatus =
  | "pending"
  | "scheduled"
  | "awaiting_approval"
  | "rework_requested"
  | "published"
  | "failed"
  | "cancelled";

export interface ReviewContext {
  scheduled_post: {
    id: string;
    site_id: string;
    title: string;
    scheduled_at: string;
    timezone: string;
    status: ScheduledPostStatus;
    rework_round: number;
    rework_comments?: string;
    prepared_at?: string;
    approved_at?: string;
  };
  blog: {
    id: string;
    title: string;
    excerpt?: string;
    content: string;
    status: string;
  } | null;
  token: {
    expires_at: string;
    rework_round: number;
  };
}

export interface ReviewDecisionResult {
  status: "approved" | "rework_requested";
  scheduled_post_id: string;
  rework_round: number;
  message: string;
}
