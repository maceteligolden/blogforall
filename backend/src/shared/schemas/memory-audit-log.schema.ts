import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface MemoryAuditLog extends BaseEntity {
  site_id: string;
  user_id?: string;
  action: "patch" | "rule_add" | "rule_supersede" | "extraction" | "digest";
  patch_keys: string[];
  previous_version?: number;
  new_version?: number;
  metadata?: Record<string, unknown>;
  created_at: Date;
}

const memoryAuditLogSchema = new Schema<MemoryAuditLog>(
  {
    site_id: { type: String, required: true, index: true },
    user_id: { type: String },
    action: { type: String, required: true },
    patch_keys: { type: [String], default: [] },
    previous_version: { type: Number },
    new_version: { type: Number },
    metadata: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

memoryAuditLogSchema.index({ site_id: 1, created_at: -1 });

export default model<MemoryAuditLog>("MemoryAuditLog", memoryAuditLogSchema);
