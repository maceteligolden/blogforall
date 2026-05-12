import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum OrchestratorThreadStatus {
  ACTIVE = "active",
  ARCHIVED = "archived",
}

/**
 * A persistent conversation between a single user and the Workspace
 * Orchestrator Agent inside a single workspace. Threads survive process
 * restarts so the user can return to a conversation at any time.
 */
export interface OrchestratorThread extends BaseEntity {
  /** Owning workspace. Indexed for tenant-scoped queries. */
  site_id: string;
  /** User who owns the thread (orchestrator threads are private per user). */
  user_id: string;
  /** Short, model- or user-assigned label shown in the thread list. */
  title: string;
  status: OrchestratorThreadStatus;
  /** Last user/assistant turn timestamp; used to sort the thread list. */
  last_activity_at: Date;
  /**
   * If the thread is in onboarding mode (created from the create-site flow)
   * the supervisor uses the onboarding system prompt and exposes the
   * `workspace.completeOnboarding` tool. Flipped to false after onboarding.
   */
  is_onboarding: boolean;
  created_at: Date;
  updated_at: Date;
}

const orchestratorThreadSchema = new Schema<OrchestratorThread>(
  {
    site_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, default: "New conversation" },
    status: {
      type: String,
      enum: Object.values(OrchestratorThreadStatus),
      default: OrchestratorThreadStatus.ACTIVE,
      index: true,
    },
    last_activity_at: { type: Date, default: Date.now, index: true },
    is_onboarding: { type: Boolean, default: false },
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
