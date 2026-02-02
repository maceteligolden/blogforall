import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface ReviewSuggestion {
  type: "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "other";
  priority: "critical" | "important" | "nice-to-have";
  line?: number;
  section?: string;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface BlogReviewResult {
  overall_score: number; // 0-100
  scores: {
    readability: number;
    seo: number;
    grammar: number;
    structure: number;
    fact_check: number;
    style: number;
  };
  suggestions: ReviewSuggestion[];
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
  summary: string;
}

export interface ReviewBlogRequest {
  title: string;
  content: string;
  excerpt?: string;
  category?: string;
}

export interface ApplyReviewRequest {
  suggestions?: string[]; // IDs or indices of suggestions to apply
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
}

export class BlogReviewService {
  /**
   * Review a blog post
   * @param blogId Optional blog ID. If provided, reviews the existing blog. If not, reviews the provided content.
   * @param data Blog content to review (required if blogId is not provided)
   */
  static async reviewBlog(blogId: string | undefined, data?: ReviewBlogRequest): Promise<{ data: { data: BlogReviewResult } }> {
    const endpoint = API_ENDPOINTS.BLOGS.REVIEW(blogId);
    return apiClient.post(endpoint, data || {});
  }

  /**
   * Apply review suggestions to a blog post
   */
  static async applyReview(blogId: string, data: ApplyReviewRequest): Promise<{ data: { data: any } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.APPLY_REVIEW(blogId), data);
  }

  /**
   * Restore a previous version of a blog post
   */
  static async restoreVersion(blogId: string, version: number): Promise<{ data: { data: any } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.RESTORE_VERSION(blogId, version));
  }
}
