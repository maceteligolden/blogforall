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
  PENDING = "pending",
  SCHEDULED = "scheduled",
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
