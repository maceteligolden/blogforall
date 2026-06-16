import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";
import { TokenLedgerEntryStatus } from "../constants/token-ledger.constant";

/**
 * Append-only audit row per AI request. `request_id` is globally unique for idempotency.
 */
export interface TokenLedgerEntry extends BaseEntity {
  request_id: string;
  user_id: string;
  feature: string;
  site_id?: string;
  status: TokenLedgerEntryStatus;
  estimated_tokens: number;
  reserved_tokens: number;
  actual_tokens?: number;
  delta?: number;
  duration_ms?: number;
  success?: boolean;
  metadata?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const tokenLedgerEntrySchema = new Schema<TokenLedgerEntry>(
  {
    request_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true, index: true },
    feature: { type: String, required: true, index: true },
    site_id: { type: String, index: true },
    status: {
      type: String,
      enum: Object.values(TokenLedgerEntryStatus),
      required: true,
      index: true,
    },
    estimated_tokens: { type: Number, required: true, default: 0 },
    reserved_tokens: { type: Number, required: true, default: 0 },
    actual_tokens: { type: Number },
    delta: { type: Number },
    duration_ms: { type: Number },
    success: { type: Boolean },
    metadata: { type: Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

tokenLedgerEntrySchema.index({ user_id: 1, created_at: -1 });

tokenLedgerEntrySchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export const TokenLedgerEntryModel = model<TokenLedgerEntry>(
  "TokenLedgerEntry",
  tokenLedgerEntrySchema
);
