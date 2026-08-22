import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum OrchestratorThreadStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
}

export type OrchestratorThreadTitleSource = "default" | "auto" | "user";
export type OrchestratorThreadChannel = "chat" | "call";
export type ThreadAssociationEntityType = "strategy" | "campaign" | "blog";

export interface ThreadAssociation {
  entity_type: ThreadAssociationEntityType;
  entity_id: string;
}

export type OrchestratorThreadFocus = {
  campaign_id?: string;
  roadmap_sequence_index?: number;
  blog_id?: string;
  topic?: string;
  intent?: string;
};

/**
 * A persistent conversation between workspace members and the Workspace
 * Orchestrator Agent. Metadata lives in Postgres; messages remain in Mongo.
 */
export interface OrchestratorThread extends BaseEntity {
  /** Owning workspace. Indexed for tenant-scoped queries. */
  site_id: string;
  /** Creator of the thread. Alias of created_by for older callers. */
  user_id: string;
  created_by: string;
  /** Short, model- or user-assigned label shown in the thread list. */
  title: string;
  /** Who last set the title — prevents auto-title from overwriting user renames. */
  title_source: OrchestratorThreadTitleSource;
  status: OrchestratorThreadStatus;
  channel: OrchestratorThreadChannel;
  /** Last user/assistant turn timestamp; used to sort the thread list. */
  last_activity_at: Date;
  /**
   * If the thread is in onboarding mode (created from the create-site flow)
   * the supervisor uses the onboarding system prompt and exposes the
   * `workspace.completeOnboarding` tool. Flipped to false after onboarding.
   */
  is_onboarding: boolean;
  /** Bound campaign, roadmap item, or post this thread is working on. */
  focus?: OrchestratorThreadFocus;
  associations?: ThreadAssociation[];
  created_at: Date;
  updated_at: Date;
}

const orchestratorThreadSchema = new Schema<OrchestratorThread>(
  {
    site_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, default: "New conversation" },
    title_source: {
      type: String,
      enum: ["default", "auto", "user"],
      default: "default",
    },
    status: {
      type: String,
      enum: Object.values(OrchestratorThreadStatus),
      default: OrchestratorThreadStatus.ACTIVE,
      index: true,
    },
    last_activity_at: { type: Date, default: Date.now, index: true },
    is_onboarding: { type: Boolean, default: false },
    focus: {
      campaign_id: { type: String },
      roadmap_sequence_index: { type: Number },
      blog_id: { type: String },
      topic: { type: String, maxlength: 400 },
      intent: { type: String, maxlength: 2000 },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

orchestratorThreadSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

orchestratorThreadSchema.index({ site_id: 1, user_id: 1, last_activity_at: -1 });
orchestratorThreadSchema.index({ site_id: 1, user_id: 1, status: 1 });

export default model<OrchestratorThread>("OrchestratorThread", orchestratorThreadSchema);
