import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Category extends BaseEntity {
  user: string; // User ID - categories are user-specific
  name: string;
  slug: string; // URL-friendly version of name
  description?: string;
  parent?: string; // Parent category ID for nesting
  color?: string; // Optional color for UI
  is_active: boolean;
}

const categorySchema = new Schema<Category>(
  {
    user: {
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
categorySchema.index({ user: 1, slug: 1 }, { unique: true });
categorySchema.index({ user: 1, parent: 1 });
categorySchema.index({ user: 1, is_active: 1 });

export default model<Category>("Category", categorySchema);
