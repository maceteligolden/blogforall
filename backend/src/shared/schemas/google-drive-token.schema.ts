import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface GoogleDriveToken extends BaseEntity {
  site_id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: Date;
  scope?: string;
  created_at: Date;
  updated_at: Date;
}

const googleDriveTokenSchema = new Schema<GoogleDriveToken>(
  {
    site_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: String, required: true },
    access_token: { type: String, required: true },
    refresh_token: { type: String },
    expires_at: { type: Date },
    scope: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default model<GoogleDriveToken>("GoogleDriveToken", googleDriveTokenSchema);
