import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

/**
 * Persisted Content Optimization report (doc 17 / inventory).
 */
export interface OptimizationReportEntity extends BaseEntity {
  report_id: string;
  workspace_id: string;
  draft_id?: string;
  research_package_id?: string;
  overall_score: number;
  quality_gate_passed: boolean;
  critical_count: number;
  /** Full ContentOptimizationReport JSON */
  report: Record<string, unknown>;
  created_by?: string;
  thread_id?: string;
}

const optimizationReportEntitySchema = new Schema<OptimizationReportEntity>(
  {
    report_id: { type: String, required: true, unique: true, index: true },
    workspace_id: { type: String, required: true, index: true },
    draft_id: { type: String, index: true },
    research_package_id: { type: String, index: true },
    overall_score: { type: Number, required: true, min: 0, max: 100 },
    quality_gate_passed: { type: Boolean, required: true },
    critical_count: { type: Number, required: true, min: 0 },
    report: { type: Schema.Types.Mixed, required: true },
    created_by: { type: String },
    thread_id: { type: String, index: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

optimizationReportEntitySchema.index({ workspace_id: 1, created_at: -1 });
optimizationReportEntitySchema.index({ workspace_id: 1, draft_id: 1 });

export default model<OptimizationReportEntity>(
  "OptimizationReport",
  optimizationReportEntitySchema,
  "optimization_reports"
);
