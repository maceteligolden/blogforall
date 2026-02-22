export type BlogStatus = "draft" | "published" | "unpublished";

/** Block types for block-based editor (matches backend) */
export type ContentBlockType =
  | "paragraph"
  | "heading"
  | "list"
  | "image"
  | "blockquote"
  | "code";

export interface ContentBlockData {
  text?: string;
  level?: number;
  items?: string[];
  listType?: "bullet" | "ordered";
  url?: string;
  caption?: string;
  language?: string;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  data:  Record<string, unknown>;
}

export interface Blog {
  _id: string;
  author: string;
  title: string;
  content: string;
  content_type: "html" | "markdown";
  /** Block-based content (when present, use for editor) */
  content_blocks?: ContentBlock[];
  slug: string;
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status: BlogStatus;
  category?: string;
  likes: number;
  liked_by: string[];
  views: number;
  published_at?: string;
  dynamic_forms?: Record<string, unknown>;
  meta?: {
    description?: string;
    keywords?: string[];
  };
  created_at?: string;
  updated_at?: string;
}

