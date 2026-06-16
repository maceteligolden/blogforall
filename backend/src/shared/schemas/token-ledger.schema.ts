import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

/**
 * Per-account rolling 24h token balance. One document per user.
 * All reserve/reconcile operations must run inside a transaction on this row.
 */
export interface TokenLedger extends BaseEntity {
  user_id: string;
  daily_allocation: number;
  window_start: Date;
  used_tokens: number;
  reserved_tokens: number;
  active_request_id?: string | null;
  active_request_expires_at?: Date | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const tokenLedgerSchema = new Schema<TokenLedger>(
  {
    user_id: { type: String, required: true, unique: true, index: true },
    daily_allocation: { type: Number, required: true, default: 0 },
    window_start: { type: Date, required: true, default: Date.now },
    used_tokens: { type: Number, required: true, default: 0, min: 0 },
    reserved_tokens: { type: Number, required: true, default: 0, min: 0 },
    active_request_id: { type: String, default: null },
    active_request_expires_at: { type: Date, default: null },
    version: { type: Number, required: true, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

tokenLedgerSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export const TokenLedgerModel = model<TokenLedger>("TokenLedger", tokenLedgerSchema);
