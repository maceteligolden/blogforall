import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Category extends BaseEntity {
  site_id: string; // Site ID - categories are site-specific
  name: string;
  slug: string; // URL-friendly version of name (unique within a site)
  description?: string;
  parent?: string; // Parent category ID for nesting
  color?: string; // Optional color for UI
  is_active: boolean;
}

const categorySchema = new Schema<Category>(
  {
    site_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    parent: {
      type: String,
      ref: "Category",
      required: false,
      index: true,
    },
    color: {
      type: String,
      maxlength: 7, // Hex color code
    },
    is_active: {
      type: Boolean,
      default: true,
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
categorySchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
categorySchema.index({ site_id: 1, slug: 1 }, { unique: true }); // Slug unique within a site
categorySchema.index({ site_id: 1, parent: 1 });
categorySchema.index({ site_id: 1, is_active: 1 });
categorySchema.index({ site_id: 1 }); // General site filtering

export default model<Category>("Category", categorySchema);
