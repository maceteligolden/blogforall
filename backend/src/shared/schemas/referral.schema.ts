import mongoose, { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum ReferralStatus {
  SIGNED_UP = "signed_up",
  REWARDED = "rewarded",
}

export interface Referral extends BaseEntity {
  referrer_user_id: string;
  referred_user_id: string;
  status: ReferralStatus;
}

const referralSchema = new Schema(
  {
    referrer_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    referred_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReferralStatus),
      default: ReferralStatus.SIGNED_UP,
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

referralSchema.pre("save", function (next) {
  (this as mongoose.Document).set("updated_at", new Date());
  next();
});

export default model<Referral>("Referral", referralSchema);
