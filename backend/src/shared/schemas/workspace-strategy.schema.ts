import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";
import type {
  ContentStrategyDocument,
  ContentStrategyGenerationStatus,
  ContentStrategySectionConfidenceMap,
} from "../types/content-strategy.document";

export type WorkspaceStrategyStatus = "active" | "archived";
export type WorkspaceStrategySource = "onboarding" | "ai" | "user" | "stub" | "website";

/**
 * Content Strategy (editorial constitution) for a workspace.
 * Distinct from per-post ContentStrategyArtifact and WorkspaceMemory.strategy_state themes.
 */
export interface WorkspaceStrategy extends BaseEntity {
  site_id: string;
  status: WorkspaceStrategyStatus;
  generation_status: ContentStrategyGenerationStatus;
  version: number;
  website_url?: string;
  document: ContentStrategyDocument;
  section_confidence: ContentStrategySectionConfidenceMap;
  generated_at?: Date;
  generation_error?: string;
  /** Flattened from document for backward-compatible readers. */
  purpose: string;
  long_term_outcomes: string[];
  principles: string[];
  audience_summary: string;
  perception_goals: string[];
  constraints: string[];
  generated_from: WorkspaceStrategySource;
  confidence_summary: number;
  updated_by?: string;
  created_at: Date;
  updated_at: Date;
}

const workspaceStrategySchema = new Schema<WorkspaceStrategy>(
  {
    site_id: { type: String, required: true, index: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    generation_status: {
      type: String,
      enum: ["generating", "ready", "failed"],
      default: "ready",
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    website_url: { type: String, maxlength: 500 },
    document: { type: Schema.Types.Mixed, default: {} },
    section_confidence: { type: Schema.Types.Mixed, default: {} },
    generated_at: { type: Date },
    generation_error: { type: String, maxlength: 2000 },
    purpose: { type: String, required: true, maxlength: 2000 },
    long_term_outcomes: { type: [String], default: [] },
    principles: { type: [String], default: [] },
    audience_summary: { type: String, default: "", maxlength: 2000 },
    perception_goals: { type: [String], default: [] },
    constraints: { type: [String], default: [] },
    generated_from: {
      type: String,
      enum: ["onboarding", "ai", "user", "stub", "website"],
      default: "stub",
    },
    confidence_summary: { type: Number, default: 0.4, min: 0, max: 1 },
    updated_by: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

workspaceStrategySchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

workspaceStrategySchema.index(
  { site_id: 1 },
  { unique: true, partialFilterExpression: { status: "active" }, name: "unique_active_strategy_per_site" }
);
workspaceStrategySchema.index({ site_id: 1, version: -1 });

export default model<WorkspaceStrategy>("WorkspaceStrategy", workspaceStrategySchema, "workspace_strategies");
