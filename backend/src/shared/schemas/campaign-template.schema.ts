import { Schema, model } from "mongoose";
import { CampaignTemplateType, PostFrequency } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignTemplate extends BaseEntity {
  name: string;
  description: string;
  type: CampaignTemplateType;
  default_goal: string; // Default goal for this template
  default_duration_days: number; // Default campaign duration in days
  default_frequency: PostFrequency;
  default_posts_count: number; // Default number of posts
  suggested_topics: string[]; // Suggested blog topics
  content_themes: string[]; // Content themes for AI generation
  ai_prompts: {
    campaign_strategy?: string; // Prompt for generating campaign strategy
    post_generation?: string; // Prompt template for generating individual posts
  };
  metadata?: {
    best_for?: string[]; // Use cases (e.g., ["B2B", "SaaS", "E-commerce"])
    industries?: string[]; // Industries this template is best for
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const campaignTemplateSchema = new Schema<CampaignTemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: Object.values(CampaignTemplateType),
      required: true,
      index: true,
    },
    default_goal: {
      type: String,
      required: true,
      maxlength: 500,
    },
    default_duration_days: {
      type: Number,
      required: true,
      min: 1,
      max: 365,
    },
    default_frequency: {
      type: String,
      enum: Object.values(PostFrequency),
      required: true,
    },
    default_posts_count: {
      type: Number,
      required: true,
      min: 1,
    },
    suggested_topics: {
      type: [String],
      default: [],
    },
    content_themes: {
      type: [String],
      default: [],
    },
    ai_prompts: {
      campaign_strategy: {
        type: String,
        maxlength: 2000,
      },
      post_generation: {
        type: String,
        maxlength: 2000,
      },
    },
    metadata: {
      best_for: {
        type: [String],
        default: [],
      },
      industries: {
        type: [String],
        default: [],
      },
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
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
campaignTemplateSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Index for active templates
campaignTemplateSchema.index({ type: 1, is_active: 1 });

export default model<CampaignTemplate>("CampaignTemplate", campaignTemplateSchema);
