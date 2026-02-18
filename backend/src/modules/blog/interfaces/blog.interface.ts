import { BlogStatus } from "../../../shared/constants";
import { ContentBlock } from "../../../shared/schemas/blog.schema";

export interface CreateBlogInput {
  title: string;
  content: string;
  content_type?: "html" | "markdown";
  /** When provided, content (HTML) is generated from blocks on save */
  content_blocks?: ContentBlock[];
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: BlogStatus;
  category?: string;
  dynamic_forms?: Record<string, unknown>;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface UpdateBlogInput {
  title?: string;
  content?: string;
  content_type?: "html" | "markdown";
  content_blocks?: ContentBlock[];
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: BlogStatus;
  category?: string;
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

export interface BlogQueryFilters {
  status?: BlogStatus;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}
