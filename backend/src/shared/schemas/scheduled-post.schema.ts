import { Schema, model } from "mongoose";
import { ScheduledPostStatus } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface ScheduledPost extends BaseEntity {
  user_id: string; // User ID who scheduled the post
  site_id: string; // Site ID
  blog_id?: string; // Blog ID if post is already created (can be null for auto-generated posts)
  campaign_id?: string; // Campaign ID if part of a campaign (can be null for standalone posts)
  title: string; // Post title (required even if blog_id exists, for preview)
  scheduled_at: Date; // When to publish the post
  timezone: string; // Timezone for scheduled_at
  status: ScheduledPostStatus;
  publish_attempts: number; // Number of times we've tried to publish
  last_attempt_at?: Date; // Last publish attempt timestamp
  error_message?: string; // Error message if publish failed
  published_at?: Date; // When the post was actually published
  auto_generate: boolean; // Whether to auto-generate content from campaign
  generation_prompt?: string; // Prompt for AI generation if auto_generate is true
  metadata?: {
    campaign_goal?: string; // Campaign goal context for generation
    target_audience?: string; // Target audience for generation
    content_theme?: string; // Content theme for this specific post
  };
  created_at: Date;
  updated_at: Date;
}

const scheduledPostSchema = new Schema<ScheduledPost>(
  {
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    site_id: {
      type: String,
      required: true,
      index: true,
    },
    blog_id: {
      type: String,
      ref: "Blog",
      index: true,
    },
    campaign_id: {
      type: String,
      ref: "Campaign",
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    scheduled_at: {
      type: Date,
      required: true,
      index: true,
    },
    timezone: {
      type: String,
      required: true,
      default: "UTC",
    },
    status: {
      type: String,
      enum: Object.values(ScheduledPostStatus),
      default: ScheduledPostStatus.PENDING,
      index: true,
    },
    publish_attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    last_attempt_at: {
      type: Date,
    },
    error_message: {
      type: String,
      maxlength: 1000,
    },
    published_at: {
      type: Date,
    },
    auto_generate: {
      type: Boolean,
      default: false,
    },
    generation_prompt: {
      type: String,
      maxlength: 2000,
    },
    metadata: {
      campaign_goal: {
        type: String,
      },
      target_audience: {
        type: String,
      },
      content_theme: {
        type: String,
      },
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Update updated_at before saving
scheduledPostSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
scheduledPostSchema.index({ site_id: 1, user_id: 1, status: 1 });
scheduledPostSchema.index({ site_id: 1, scheduled_at: 1, status: 1 }); // For calendar queries
scheduledPostSchema.index({ campaign_id: 1, scheduled_at: 1 }); // For campaign posts
scheduledPostSchema.index({ status: 1, scheduled_at: 1 }); // For scheduler queries (critical)
scheduledPostSchema.index({ blog_id: 1 }); // For checking if blog is scheduled
scheduledPostSchema.index({ site_id: 1, scheduled_at: 1 }); // General calendar view

export default model<ScheduledPost>("ScheduledPost", scheduledPostSchema);
