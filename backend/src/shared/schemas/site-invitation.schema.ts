import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";
import { SiteMemberRole, InvitationStatus } from "../constants";

export interface SiteInvitation extends BaseEntity {
  site_id: string; // Site ID
  email: string; // Email of the invited user
  role: SiteMemberRole; // Role to be assigned when accepted
  token: string; // Unique token for invitation acceptance
  status: InvitationStatus; // pending, accepted, rejected, expired
  invited_by: string; // User ID who sent the invitation
  expires_at: Date; // Expiration date (24 hours from creation)
  accepted_at?: Date; // When the invitation was accepted
  created_at: Date;
  updated_at: Date;
}

const siteInvitationSchema = new Schema<SiteInvitation>(
  {
    site_id: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(SiteMemberRole),
      required: true,
      default: SiteMemberRole.VIEWER,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(InvitationStatus),
      required: true,
      default: InvitationStatus.PENDING,
      index: true,
    },
    invited_by: {
      type: String,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    accepted_at: {
      type: Date,
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
siteInvitationSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
siteInvitationSchema.index({ site_id: 1, email: 1, status: 1 }); // Find pending invitations for a site and email
siteInvitationSchema.index({ token: 1 }, { unique: true }); // Find invitation by token
siteInvitationSchema.index({ email: 1, status: 1 }); // Find user's invitations
siteInvitationSchema.index({ expires_at: 1 }); // For cleanup of expired invitations

export default model<SiteInvitation>("SiteInvitation", siteInvitationSchema);
