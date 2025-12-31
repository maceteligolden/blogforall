import { BlogStatus } from "../../../shared/constants";

export interface CreateBlogInput {
  title: string;
  content: string;
  content_type?: "html" | "markdown";
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: BlogStatus;
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
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: BlogStatus;
  dynamic_forms?: Record<string, unknown>;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface BlogQueryFilters {
  status?: BlogStatus;
  search?: string;
  page?: number;
  limit?: number;
}

