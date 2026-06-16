import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum ReviewTokenAction {
  APPROVED = "approved",
  REWORK_REQUESTED = "rework_requested",
}

/**
 * Single-use signed token sent in approval emails for scheduled posts.
 * Stored as a SHA-256 hash with a short lookup prefix so the unauthenticated
 * review endpoint can find the row in O(1) and then constant-time verify.
 * Refreshed (new token) whenever a rework loop produces a new draft.
 */
export interface ScheduledPostReviewToken extends BaseEntity {
  site_id: string;
  scheduled_post_id: string;
  /** Workspace owner / approver the token was minted for. */
  user_id: string;
  /** First 16 chars of the raw token, used as a non-secret lookup key. */
  token_lookup: string;
  /** Full SHA-256 hex digest of the raw token. */
  token_hash: string;
  expires_at: Date;
  used_at?: Date;
  used_action?: ReviewTokenAction;
  /** Rework round this token was minted for; matches ScheduledPost.rework_round. */
  rework_round: number;
  created_at: Date;
  updated_at: Date;
}

const reviewTokenSchema = new Schema<ScheduledPostReviewToken>(
  {
    site_id: { type: String, required: true, index: true },
    scheduled_post_id: { type: String, required: true, index: true },
    user_id: { type: String, required: true, index: true },
    token_lookup: { type: String, required: true, index: true },
    token_hash: { type: String, required: true },
    expires_at: { type: Date, required: true, index: true },
    used_at: { type: Date },
    used_action: { type: String, enum: Object.values(ReviewTokenAction) },
    rework_round: { type: Number, default: 0, min: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

reviewTokenSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

reviewTokenSchema.index({ site_id: 1, scheduled_post_id: 1, used_at: 1 });
reviewTokenSchema.index({ token_lookup: 1, used_at: 1 });
// Mongo TTL: auto-cleanup of expired+used tokens. Tokens past expires_at are
// removed after 30 days so audit history is retained for a window.
reviewTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default model<ScheduledPostReviewToken>("ScheduledPostReviewToken", reviewTokenSchema);
