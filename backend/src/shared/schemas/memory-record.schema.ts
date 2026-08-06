import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export type MemoryRecordLayer =
  | "session"
  | "workspace"
  | "user_preference"
  | "knowledge"
  | "learning"
  | "content_intelligence"
  | "temporary";

/**
 * Layered belief MemoryRecord (doc 18). Mongo is MVP system of record.
 */
export interface MemoryRecordEntity extends BaseEntity {
  record_id: string;
  workspace_id: string;
  user_id?: string | null;
  layer: MemoryRecordLayer;
  canonical_key: string;
  value: unknown;
  value_text?: string;
  metadata: {
    created_at: string;
    updated_at: string;
    confidence: number;
    importance: number;
    cognitive_kind?: "semantic" | "episodic" | "procedural";
    superseded_by?: string;
    soft_deleted?: boolean;
    source_turn_id?: string;
    source?: string;
    belief_status?: "new" | "confirmed" | "updated" | "invalidated";
    version: number;
  };
}

const memoryRecordEntitySchema = new Schema<MemoryRecordEntity>(
  {
    record_id: { type: String, required: true, unique: true, index: true },
    workspace_id: { type: String, required: true, index: true },
    user_id: { type: String, default: null, index: true },
    layer: {
      type: String,
      enum: ["session", "workspace", "user_preference", "knowledge", "learning", "content_intelligence", "temporary"],
      required: true,
      index: true,
    },
    canonical_key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    value_text: { type: String, maxlength: 8000 },
    metadata: {
      created_at: { type: String, required: true },
      updated_at: { type: String, required: true },
      confidence: { type: Number, required: true, min: 0, max: 1 },
      importance: { type: Number, required: true, min: 0, max: 1 },
      cognitive_kind: { type: String, enum: ["semantic", "episodic", "procedural"] },
      superseded_by: { type: String },
      soft_deleted: { type: Boolean, default: false },
      source_turn_id: { type: String },
      source: { type: String },
      belief_status: {
        type: String,
        enum: ["new", "confirmed", "updated", "invalidated"],
      },
      version: { type: Number, required: true, min: 1 },
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

memoryRecordEntitySchema.index({ workspace_id: 1, layer: 1, canonical_key: 1, user_id: 1 }, { unique: true });
memoryRecordEntitySchema.index({ workspace_id: 1, layer: 1, "metadata.soft_deleted": 1 });

export default model<MemoryRecordEntity>("MemoryRecord", memoryRecordEntitySchema, "memory_records");
