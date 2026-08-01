import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export type WorkspaceStrategyStatus = "active" | "archived";
export type WorkspaceStrategySource = "onboarding" | "ai" | "user" | "stub";

/**
 * Long-term business direction for a workspace (doc 21).
 * Distinct from per-post ContentStrategyArtifact and WorkspaceMemory.strategy_state themes.
 */
export interface WorkspaceStrategy extends BaseEntity {
  site_id: string;
  status: WorkspaceStrategyStatus;
  version: number;
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
    version: { type: Number, required: true, min: 1 },
    purpose: { type: String, required: true, maxlength: 2000 },
    long_term_outcomes: { type: [String], default: [] },
    principles: { type: [String], default: [] },
    audience_summary: { type: String, default: "", maxlength: 2000 },
    perception_goals: { type: [String], default: [] },
    constraints: { type: [String], default: [] },
    generated_from: {
      type: String,
      enum: ["onboarding", "ai", "user", "stub"],
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
