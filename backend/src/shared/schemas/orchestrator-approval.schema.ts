import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum OrchestratorApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXECUTED = "executed",
  EXPIRED = "expired",
}

/**
 * Surface this approval was raised from. Drives notification routing
 * and approve/reject UI choices.
 */
export enum OrchestratorApprovalKind {
  /** Destructive in-chat action (e.g. blogs.delete) awaiting yes/cancel. */
  IN_CHAT_CONFIRMATION = "in_chat_confirmation",
  /** Memory mutation that would alter strategic direction. */
  MEMORY_UPDATE = "memory_update",
  /** Scheduled-post pre-publish review (also tracked via review tokens). */
  SCHEDULED_POST_REVIEW = "scheduled_post_review",
  /** Campaign proposal awaiting confirmation before creation. */
  CAMPAIGN_PROPOSAL = "campaign_proposal",
  /** Campaign content roadmap awaiting approval before activation. */
  CAMPAIGN_ROADMAP_APPROVAL = "campaign_roadmap_approval",
}

/**
 * A persistent approval row that records an action waiting on a human
 * decision. Every workspace write that requires approval routes through
 * this table so refreshes / new devices see the pending state.
 */
export interface OrchestratorApproval extends BaseEntity {
  site_id: string;
  /** Thread the approval belongs to; null for system-raised approvals (e.g. scheduler). */
  thread_id?: string;
  /** User who must decide (typically the workspace owner). */
  requested_for_user_id: string;
  /** User who initiated the action (usually same as requested_for_user_id). */
  requested_by_user_id: string;
  kind: OrchestratorApprovalKind;
  /** Tool or action identifier (e.g. "blogs.delete"). */
  action: string;
  /** Human-readable summary the UI / email shows. */
  summary: string;
  /** Structured payload re-run when approved. */
  payload: Record<string, unknown>;
  status: OrchestratorApprovalStatus;
  requested_at: Date;
  /** Optional auto-reject deadline (e.g. in-chat confirmation TTL). */
  expires_at?: Date;
  decided_at?: Date;
  decided_by_user_id?: string;
  /** Free-text decision note (e.g. rework comments). */
  decision_note?: string;
  /** Tool execution outcome once status transitions to EXECUTED. */
  execution_result?: {
    ok: boolean;
    summary?: string;
    data?: unknown;
    error?: string;
  };
  created_at: Date;
  updated_at: Date;
}

const orchestratorApprovalSchema = new Schema<OrchestratorApproval>(
  {
    site_id: { type: String, required: true, index: true },
    thread_id: { type: String, index: true },
    requested_for_user_id: { type: String, required: true, index: true },
    requested_by_user_id: { type: String, required: true },
    kind: { type: String, enum: Object.values(OrchestratorApprovalKind), required: true, index: true },
    action: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 2000 },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: Object.values(OrchestratorApprovalStatus),
      default: OrchestratorApprovalStatus.PENDING,
      index: true,
    },
    requested_at: { type: Date, default: Date.now, index: true },
    expires_at: { type: Date, index: true },
    decided_at: { type: Date },
    decided_by_user_id: { type: String },
    decision_note: { type: String, maxlength: 4000 },
    execution_result: {
      ok: { type: Boolean },
      summary: { type: String },
      data: { type: Schema.Types.Mixed },
      error: { type: String },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

orchestratorApprovalSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

orchestratorApprovalSchema.index({ site_id: 1, status: 1, requested_at: -1 });
orchestratorApprovalSchema.index({ site_id: 1, requested_for_user_id: 1, status: 1, requested_at: -1 });
orchestratorApprovalSchema.index({ thread_id: 1, status: 1 });

export default model<OrchestratorApproval>("OrchestratorApproval", orchestratorApprovalSchema);
