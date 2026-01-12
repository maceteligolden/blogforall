import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Comment extends BaseEntity {
  blog: string; // Blog ID
  author_name: string; // Guest name (required for guests)
  author_email?: string; // Guest email (optional)
  author_id?: string; // User ID if logged in (optional)
  content: string;
  parent_comment?: string; // For nested/reply comments
  is_approved: boolean;
  likes: number;
  liked_by: string[]; // Array of user IDs or IP addresses
}

const commentSchema = new Schema<Comment>(
  {
    blog: {
      type: String,
      required: true,
      ref: "Blog",
      index: true,
    },
    author_name: {
      type: String,
      required: true,
      trim: true,
    },
    author_email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    author_id: {
      type: String,
      required: false,
      ref: "User",
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    parent_comment: {
      type: String,
      required: false,
      ref: "Comment",
    },
    is_approved: {
      type: Boolean,
      default: true, // Auto-approve for now
    },
    likes: {
      type: Number,
      default: 0,
    },
    liked_by: {
      type: [String],
      default: [],
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
commentSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// Indexes for better query performance
commentSchema.index({ blog: 1, created_at: -1 });
commentSchema.index({ parent_comment: 1 });

export default model<Comment>("Comment", commentSchema);
