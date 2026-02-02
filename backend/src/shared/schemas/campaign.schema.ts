import { Schema, model } from "mongoose";
import { CampaignStatus, PostFrequency } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface Campaign extends BaseEntity {
  user_id: string; // User ID who created the campaign
  site_id: string; // Site ID - campaigns belong to a site
  name: string;
  description?: string;
  goal: string; // Campaign goal (e.g., "Increase signups", "Product launch")
  target_audience?: string; // Target audience description
  status: CampaignStatus;
  start_date: Date;
  end_date: Date;
  posting_frequency: PostFrequency;
  custom_schedule?: string; // Cron expression for custom frequency
  timezone: string; // User's timezone (e.g., "America/New_York")
  total_posts_planned?: number; // Total number of posts planned
  posts_published: number; // Number of posts already published
  budget?: number; // Optional budget
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[]; // Custom KPIs
  };
  ai_strategy?: {
    content_themes?: string[]; // AI-generated content themes
    suggested_topics?: string[]; // AI-suggested blog topics
    optimal_times?: string[]; // AI-suggested optimal posting times
  };
  template_id?: string; // Reference to campaign template if used
  created_at: Date;
  updated_at: Date;
}

const campaignSchema = new Schema<Campaign>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    goal: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    target_audience: {
      type: String,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.DRAFT,
      index: true,
    },
    start_date: {
      type: Date,
      required: true,
      index: true,
    },
    end_date: {
      type: Date,
      required: true,
      index: true,
    },
    posting_frequency: {
      type: String,
      enum: Object.values(PostFrequency),
      required: true,
    },
    custom_schedule: {
      type: String, // Cron expression
    },
    timezone: {
      type: String,
      required: true,
      default: "UTC",
    },
    total_posts_planned: {
      type: Number,
      min: 1,
    },
    posts_published: {
      type: Number,
      default: 0,
      min: 0,
    },
    budget: {
      type: Number,
      min: 0,
    },
    success_metrics: {
      target_views: {
        type: Number,
        min: 0,
      },
      target_engagement: {
        type: Number,
        min: 0,
      },
      target_conversions: {
        type: Number,
        min: 0,
      },
      kpis: {
        type: [String],
        default: [],
      },
    },
    ai_strategy: {
      content_themes: {
        type: [String],
        default: [],
      },
      suggested_topics: {
        type: [String],
        default: [],
      },
      optimal_times: {
        type: [String],
        default: [],
      },
    },
    template_id: {
      type: String,
      ref: "CampaignTemplate",
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
campaignSchema.pre("save", function (next) {
  this.updated_at = new Date();

  // Auto-update status based on dates
  const now = new Date();
  if (this.status === CampaignStatus.ACTIVE) {
    if (this.end_date < now) {
      this.status = CampaignStatus.COMPLETED;
    }
  }

  next();
});

// Indexes for efficient queries
campaignSchema.index({ site_id: 1, user_id: 1, status: 1 });
campaignSchema.index({ site_id: 1, status: 1, start_date: 1 });
campaignSchema.index({ site_id: 1, start_date: 1, end_date: 1 });
campaignSchema.index({ status: 1, start_date: 1, end_date: 1 }); // For scheduler queries

export default model<Campaign>("Campaign", campaignSchema);
