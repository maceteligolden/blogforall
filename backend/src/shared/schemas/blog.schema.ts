import { BlogStatus } from "../constants";
import { BaseEntity } from "../interfaces";

export type ContentBlockType = "paragraph" | "heading" | "list" | "image" | "blockquote" | "code";

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
  data: ContentBlockData;
}

export interface Blog extends BaseEntity {
  author: string;
  site_id: string;
  campaign_id?: string;
  strategy_id?: string;
  title: string;
  content: string;
  content_type: "html" | "markdown";
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
  published_at?: Date;
  dynamic_forms?: Record<string, unknown>;
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
    review_id?: string;
  }>;
}
