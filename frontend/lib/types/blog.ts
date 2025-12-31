export type BlogStatus = "draft" | "published" | "unpublished";

export interface Blog {
  _id: string;
  author: string;
  title: string;
  content: string;
  content_type: "html" | "markdown";
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

