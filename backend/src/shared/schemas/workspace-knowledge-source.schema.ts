import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export type KnowledgeSourceProvider = "upload" | "google_drive";

export interface KnowledgeFileRef {
  name: string;
  url: string;
  mime_type: string;
  extracted_text?: string;
}

export interface WorkspaceKnowledgeSource extends BaseEntity {
  site_id: string;
  user_id: string;
  provider: KnowledgeSourceProvider;
  name: string;
  status: "active" | "disconnected";
  config?: Record<string, unknown>;
  file_refs: KnowledgeFileRef[];
  created_at: Date;
  updated_at: Date;
}

const workspaceKnowledgeSourceSchema = new Schema<WorkspaceKnowledgeSource>(
  {
    site_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    provider: { type: String, enum: ["upload", "google_drive"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 256 },
    status: { type: String, enum: ["active", "disconnected"], default: "active" },
    config: { type: Schema.Types.Mixed },
    file_refs: {
      type: [
        {
          name: { type: String, required: true },
          url: { type: String, required: true },
          mime_type: { type: String, required: true },
          extracted_text: { type: String },
        },
      ],
      default: [],
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

workspaceKnowledgeSourceSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

workspaceKnowledgeSourceSchema.index({ site_id: 1, status: 1 });

export default model<WorkspaceKnowledgeSource>(
  "WorkspaceKnowledgeSource",
  workspaceKnowledgeSourceSchema
);
