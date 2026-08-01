import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

/**
 * Persisted Research Package (doc 16 / inventory).
 * `package` holds the Zod-validated ResearchPackage body; indexed fields aid listing.
 */
export interface ResearchPackageEntity extends BaseEntity {
  package_id: string;
  workspace_id: string;
  depth: "lite" | "full";
  topic: string;
  coverage_score: number;
  source_count: number;
  degraded?: boolean;
  summary: {
    topic: string;
    depth: "lite" | "full";
    coverage_score: number;
    source_count: number;
    contradiction_count: number;
    degraded?: boolean;
  };
  /** Full ResearchPackage JSON */
  package: Record<string, unknown>;
  created_by?: string;
  thread_id?: string;
}

const researchPackageEntitySchema = new Schema<ResearchPackageEntity>(
  {
    package_id: { type: String, required: true, unique: true, index: true },
    workspace_id: { type: String, required: true, index: true },
    depth: { type: String, enum: ["lite", "full"], required: true },
    topic: { type: String, required: true, maxlength: 500 },
    coverage_score: { type: Number, required: true, min: 0, max: 1 },
    source_count: { type: Number, required: true, min: 0 },
    degraded: { type: Boolean },
    summary: {
      topic: { type: String, required: true },
      depth: { type: String, enum: ["lite", "full"], required: true },
      coverage_score: { type: Number, required: true },
      source_count: { type: Number, required: true },
      contradiction_count: { type: Number, required: true },
      degraded: { type: Boolean },
    },
    package: { type: Schema.Types.Mixed, required: true },
    created_by: { type: String },
    thread_id: { type: String, index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

researchPackageEntitySchema.index({ workspace_id: 1, created_at: -1 });
researchPackageEntitySchema.index({ workspace_id: 1, topic: 1 });

export default model<ResearchPackageEntity>("ResearchPackage", researchPackageEntitySchema, "research_packages");
