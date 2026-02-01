import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Site extends BaseEntity {
  name: string;
  description?: string;
  slug: string; // URL-friendly identifier, globally unique
  owner: string; // User ID of the site owner
  created_at: Date;
  updated_at: Date;
}

const siteSchema = new Schema<Site>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/, // Only lowercase letters, numbers, and hyphens
    },
    owner: {
      type: String,
      required: true,
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
  {
    timestamps: false,
  }
);

// Update updated_at before saving
siteSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
siteSchema.index({ owner: 1 });
siteSchema.index({ slug: 1 }, { unique: true });

export default model<Site>("Site", siteSchema);
