export enum CampaignStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

export enum PostFrequency {
  DAILY = "daily",
  WEEKLY = "weekly",
  BIWEEKLY = "biweekly", // Every 2 weeks
  MONTHLY = "monthly",
  CUSTOM = "custom", // User-defined schedule
}

export enum ScheduledPostStatus {
  /** Newly created; not yet picked up by the scheduler. */
  PENDING = "pending",
  /** Scheduler picked it up and the publish window is in the future. */
  SCHEDULED = "scheduled",
  /**
   * The pre-publish worker has generated and reviewed a draft. The post is
   * blocked on a human approval (in-app and/or email weekly digest) before
   * it can transition to PUBLISHED.
   */
  AWAITING_APPROVAL = "awaiting_approval",
  /**
   * The approver requested edits (rework). The orchestrator regenerates the
   * draft using their comments; on success the post returns to
   * AWAITING_APPROVAL with a fresh review token.
   */
  REWORK_REQUESTED = "rework_requested",
  PUBLISHED = "published",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum CampaignTemplateType {
  PRODUCT_LAUNCH = "product_launch",
  HOLIDAY_CAMPAIGN = "holiday_campaign",
  BRAND_AWARENESS = "brand_awareness",
  CONTENT_MARKETING = "content_marketing",
  SEASONAL = "seasonal",
  EVENT_PROMOTION = "event_promotion",
  EDUCATIONAL = "educational",
  CUSTOM = "custom",
}
