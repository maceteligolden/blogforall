import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

/**
 * Strategic, slow-changing facts about the workspace. Captured during the
 * orchestrator onboarding chat and refined over time.
 */
export interface WorkspaceMemoryStrategic {
  business_type?: string;
  target_audience: string[];
  brand_voice?: string;
  business_goals: string[];
  seo_priorities: string[];
  publishing_channels: string[];
  competitive_notes?: string;
}

/**
 * Operational settings the orchestrator uses to decide when human approval
 * is required and how to plan automated publishing.
 */
export interface WorkspaceMemoryOperational {
  publishing_cadence?: string;
  approval_rules: {
    publish_blog_requires_approval: boolean;
    delete_content_requires_approval: boolean;
    update_brand_guidelines_requires_approval: boolean;
    create_category_requires_approval: boolean;
    auto_execute_low_risk: boolean;
  };
  automation_settings: {
    auto_generate_scheduled_posts: boolean;
  };
  /** Hours before a scheduled_at to prepare a draft and request approval. */
  review_lead_time_hours: number;
}

export interface WorkspaceMemoryPreferences {
  tone?: string;
  formatting?: string;
  communication_style?: string;
  default_word_count?: number;
}

export interface WorkspaceMemoryPerformance {
  last_summarized_at?: Date;
  summary?: string;
}

export interface WorkspaceMemory extends BaseEntity {
  /** Workspace this memory belongs to. One memory doc per site. */
  site_id: string;
  strategic: WorkspaceMemoryStrategic;
  operational: WorkspaceMemoryOperational;
  preferences: WorkspaceMemoryPreferences;
  /** Rolling summary of recent blogs/themes; refreshed by memory-digest cron. */
  content_summary: string;
  performance_summary: WorkspaceMemoryPerformance;
  /** Short text injected into every supervisor turn. */
  memory_summary: string;
  /** Increment-only version; bumped on every write for optimistic concurrency. */
  version: number;
  /** User id of the last writer (orchestrator tools attribute back to caller). */
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const APPROVAL_RULES_DEFAULTS = {
  publish_blog_requires_approval: true,
  delete_content_requires_approval: true,
  update_brand_guidelines_requires_approval: true,
  create_category_requires_approval: false,
  auto_execute_low_risk: true,
};

const AUTOMATION_SETTINGS_DEFAULTS = {
  auto_generate_scheduled_posts: true,
};

const workspaceMemorySchema = new Schema<WorkspaceMemory>(
  {
    site_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    strategic: {
      business_type: { type: String, trim: true, maxlength: 200 },
      target_audience: { type: [String], default: [] },
      brand_voice: { type: String, trim: true, maxlength: 1000 },
      business_goals: { type: [String], default: [] },
      seo_priorities: { type: [String], default: [] },
      publishing_channels: { type: [String], default: [] },
      competitive_notes: { type: String, maxlength: 4000 },
    },
    operational: {
      publishing_cadence: { type: String, trim: true, maxlength: 200 },
      approval_rules: {
        publish_blog_requires_approval: {
          type: Boolean,
          default: APPROVAL_RULES_DEFAULTS.publish_blog_requires_approval,
        },
        delete_content_requires_approval: {
          type: Boolean,
          default: APPROVAL_RULES_DEFAULTS.delete_content_requires_approval,
        },
        update_brand_guidelines_requires_approval: {
          type: Boolean,
          default: APPROVAL_RULES_DEFAULTS.update_brand_guidelines_requires_approval,
        },
        create_category_requires_approval: {
          type: Boolean,
          default: APPROVAL_RULES_DEFAULTS.create_category_requires_approval,
        },
        auto_execute_low_risk: {
          type: Boolean,
          default: APPROVAL_RULES_DEFAULTS.auto_execute_low_risk,
        },
      },
      automation_settings: {
        auto_generate_scheduled_posts: {
          type: Boolean,
          default: AUTOMATION_SETTINGS_DEFAULTS.auto_generate_scheduled_posts,
        },
      },
      review_lead_time_hours: { type: Number, default: 72, min: 1, max: 24 * 14 },
    },
    preferences: {
      tone: { type: String, trim: true, maxlength: 200 },
      formatting: { type: String, trim: true, maxlength: 500 },
      communication_style: { type: String, trim: true, maxlength: 500 },
      default_word_count: { type: Number, min: 300, max: 8000 },
    },
    content_summary: { type: String, default: "", maxlength: 8000 },
    performance_summary: {
      last_summarized_at: { type: Date },
      summary: { type: String, maxlength: 4000 },
    },
    memory_summary: { type: String, default: "", maxlength: 4000 },
    version: { type: Number, default: 1, min: 1 },
    updated_by: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

workspaceMemorySchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

workspaceMemorySchema.index({ site_id: 1 }, { unique: true });

export default model<WorkspaceMemory>("WorkspaceMemory", workspaceMemorySchema);

export const WORKSPACE_MEMORY_DEFAULTS = {
  approval_rules: APPROVAL_RULES_DEFAULTS,
  automation_settings: AUTOMATION_SETTINGS_DEFAULTS,
} as const;
