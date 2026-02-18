import { Schema, model } from "mongoose";
import { BlogStatus } from "../constants";
import { BaseEntity } from "../interfaces";

/** Block types for block-based editor (headless / structured content) */
export type ContentBlockType = "paragraph" | "heading" | "list" | "image" | "blockquote" | "code";

export interface ContentBlockData {
  text?: string;
  level?: number; // heading 1-3
  items?: string[]; // list
  listType?: "bullet" | "ordered";
  url?: string;
  caption?: string;
  language?: string;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  data: ContentBlockData;
}

export interface Blog extends BaseEntity {
  author: string; // User ID
  site_id: string; // Site ID - blogs belong to a site
  title: string;
  content: string; // HTML or Markdown content (generated from content_blocks when present)
  content_type: "html" | "markdown";
  /** Block-based content (source of truth when present); HTML is generated from this on save */
  content_blocks?: ContentBlock[];
  slug: string; // URL-friendly version of title (unique within a site)
  excerpt?: string; // Short description
  featured_image?: string; // Path to featured image
  images?: string[]; // Array of image paths
  status: BlogStatus;
  category?: string; // Category ID
  likes: number;
  liked_by: string[]; // Array of user IDs or guest IPs
  views: number;
  published_at?: Date;
  dynamic_forms?: Record<string, unknown>; // For dynamic form data
  meta?: {
    description?: string;
    keywords?: string[];
  };
  version_history?: Array<{
    version: number;
    content: string;
    title: string;
    excerpt?: string;
    created_at: Date;
    review_id?: string; // Reference to review that created this version
  }>;
}

const blogSchema = new Schema<Blog>(
  {
    author: {
      type: String,
      required: true,
      index: true,
    },
    site_id: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
    },
    content_type: {
      type: String,
      enum: ["html", "markdown"],
      default: "html",
    },
    content_blocks: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    slug: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    excerpt: {
      type: String,
      maxlength: 500,
    },
    featured_image: {
      type: String,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(BlogStatus),
      default: BlogStatus.DRAFT,
      index: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    liked_by: {
      type: [String],
      default: [],
    },
    views: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      ref: "Category",
      required: false,
      index: true,
    },
    published_at: {
      type: Date,
    },
    dynamic_forms: {
      type: Schema.Types.Mixed,
      default: {},
    },
    meta: {
      description: {
        type: String,
        maxlength: 300,
      },
      keywords: {
        type: [String],
        default: [],
      },
    },
    version_history: {
      type: [
        {
          version: {
            type: Number,
            required: true,
          },
          content: {
            type: String,
            required: true,
          },
          title: {
            type: String,
            required: true,
          },
          excerpt: {
            type: String,
          },
          created_at: {
            type: Date,
            default: Date.now,
          },
          review_id: {
            type: String,
          },
        },
      ],
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
blogSchema.pre("save", function (next) {
  this.updated_at = new Date();
  if (this.status === BlogStatus.PUBLISHED && !this.published_at) {
    this.published_at = new Date();
  }
  next();
});

// Index for efficient queries
blogSchema.index({ site_id: 1, author: 1, status: 1 });
blogSchema.index({ site_id: 1, status: 1, published_at: -1 });
blogSchema.index({ site_id: 1, slug: 1 }, { unique: true }); // Slug unique within a site
blogSchema.index({ site_id: 1, category: 1, status: 1 });
blogSchema.index({ site_id: 1 }); // General site filtering

export default model<Blog>("Blog", blogSchema);
