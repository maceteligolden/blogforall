import mongoose, { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface WaitlistEntry extends BaseEntity {
  email: string;
  first_name: string;
  last_name: string;
  source: string;
  brevo_synced: boolean;
  brevo_contact_id?: number;
  brevo_sync_error?: string;
}

const waitlistSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      default: "landing_page",
    },
    brevo_synced: {
      type: Boolean,
      default: false,
      index: true,
    },
    brevo_contact_id: {
      type: Number,
    },
    brevo_sync_error: {
      type: String,
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

waitlistSchema.pre("save", function (next) {
  (this as mongoose.Document).set("updated_at", new Date());
  next();
});

export default model<WaitlistEntry>("WaitlistEntry", waitlistSchema);
