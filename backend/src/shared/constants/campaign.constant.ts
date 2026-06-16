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

/** Strategic campaign type — drives planning templates. */
export enum CampaignType {
  SEO_AUTHORITY = "seo_authority",
  PRODUCT_LAUNCH = "product_launch",
  FEATURE_AWARENESS = "feature_awareness",
  LEAD_GENERATION = "lead_generation",
  EDUCATIONAL_SERIES = "educational_series",
  THOUGHT_LEADERSHIP = "thought_leadership",
  CUSTOMER_RETENTION = "customer_retention",
  SEASONAL = "seasonal",
  COMPARISON_COMPETITOR = "comparison_competitor",
  INDUSTRY_TREND = "industry_trend",
  CUSTOM = "custom",
}

/** Lifecycle state (distinct from health). Maps legacy `status` on read. */
export enum CampaignLifecycleStatus {
  DRAFT = "draft",
  PLANNING = "planning",
  AWAITING_APPROVAL = "awaiting_approval",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  ARCHIVED = "archived",
  FAILED = "failed",
}

export enum CampaignHealthStatus {
  ON_TRACK = "on_track",
  AT_RISK = "at_risk",
  UNDERPERFORMING = "underperforming",
  EXCEEDING = "exceeding_expectations",
  UNKNOWN = "unknown",
}

export enum CampaignContentAutonomy {
  MANUAL = "manual",
  ASSISTED = "assisted",
}

export enum CampaignPublishingMode {
  SCHEDULED_HITL = "scheduled_hitl",
}

export enum CampaignApprovalPolicy {
  REQUIRE_PRE_PUBLISH_APPROVAL = "require_pre_publish_approval",
}

export enum CampaignPostItemStatus {
  IDEA = "idea",
  PLANNED = "planned",
  DRAFTING = "drafting",
  DRAFT_READY = "draft_ready",
  SCHEDULED = "scheduled",
  AWAITING_APPROVAL = "awaiting_approval",
  PUBLISHED = "published",
  SKIPPED = "skipped",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum CampaignRoadmapStatus {
  DRAFT = "draft",
  PROPOSED = "proposed",
  APPROVED = "approved",
  SUPERSEDED = "superseded",
}

export enum CampaignEventType {
  CAMPAIGN_CREATED = "campaign.created",
  ROADMAP_PROPOSED = "roadmap.proposed",
  ROADMAP_APPROVED = "roadmap.approved",
  ROADMAP_REJECTED = "roadmap.rejected",
  ITEM_ADDED = "item.added",
  POST_SCHEDULED = "post.scheduled",
  POST_PUBLISHED = "post.published",
  POST_FAILED = "post.failed",
  HEALTH_CHANGED = "health.changed",
  PROGRESS_REPORT_GENERATED = "progress_report.generated",
  PROGRESS_REPORT_EMAILED = "progress_report.emailed",
}
