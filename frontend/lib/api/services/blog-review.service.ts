import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export type SuggestionTarget = "title" | "excerpt" | "content";

export interface ReviewSuggestion {
  id?: string;
  type: "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "engagement" | "other";
  priority: "critical" | "important" | "nice-to-have";
  line?: number;
  section?: string;
  target?: SuggestionTarget;
  blockId?: string;
  blockIndex?: number;
  startOffset?: number;
  endOffset?: number;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface BlogReviewResult {
  overall_score: number;
  scores: {
    readability: number;
    seo: number;
    grammar: number;
    structure: number;
    fact_check: number;
    style: number;
    engagement: number;
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
  content_blocks?: { id: string; type: string; data: Record<string, unknown> }[];
}

export interface ApplyReviewRequest {
  suggestions?: string[];
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
}

export interface ApplyOneRequest {
  suggestion_id: string;
  target: SuggestionTarget;
  original: string;
  suggestion: string;
  blockId?: string;
  blockIndex?: number;
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
  static async applyReview(blogId: string | undefined, data: ApplyReviewRequest): Promise<{ data: { data: any } }> {
    if (!blogId) {
      throw new Error("Blog ID is required to apply review");
    }
    return apiClient.post(API_ENDPOINTS.BLOGS.APPLY_REVIEW(blogId), data);
  }

  /**
   * Apply a single suggestion (auto-save; undo via restore version).
   */
  static async applyOne(blogId: string, data: ApplyOneRequest): Promise<{ data: { data: unknown } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.APPLY_ONE(blogId), data);
  }

  /**
   * Restore a previous version of a blog post
   */
  static async restoreVersion(blogId: string, version: number): Promise<{ data: { data: unknown } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.RESTORE_VERSION(blogId, version));
  }
}
