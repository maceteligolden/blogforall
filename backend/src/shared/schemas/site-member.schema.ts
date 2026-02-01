import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";
import { SiteMemberRole } from "../constants";

export interface SiteMember extends BaseEntity {
  site_id: string; // Site ID
  user_id: string; // User ID
  role: SiteMemberRole; // owner, admin, editor, viewer
  joined_at: Date; // When the user joined the site
  created_at: Date;
  updated_at: Date;
}

const siteMemberSchema = new Schema<SiteMember>(
  {
    site_id: {
      type: String,
      required: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(SiteMemberRole),
      required: true,
      default: SiteMemberRole.VIEWER,
    },
    joined_at: {
      type: Date,
      default: Date.now,
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
  {
    timestamps: false,
  }
);

// Update updated_at before saving
siteMemberSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
siteMemberSchema.index({ site_id: 1, user_id: 1 }, { unique: true }); // One role per user per site
siteMemberSchema.index({ user_id: 1 }); // Find all sites a user belongs to
siteMemberSchema.index({ site_id: 1, role: 1 }); // Find members by site and role

export default model<SiteMember>("SiteMember", siteMemberSchema);
