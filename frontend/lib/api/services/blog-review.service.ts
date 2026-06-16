import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

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
export interface ContentBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}
export interface ReviewBlogRequest {
  title: string;
  content: string;
  excerpt?: string;
  category?: string;
  content_blocks?: ContentBlock[] | undefined;
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

function requireSiteId(): string {
  if (typeof window === "undefined") {
    throw new Error("Blog review requires a browser context");
  }
  const siteId = useAuthStore.getState().currentSiteId;
  if (!siteId) {
    throw new Error("No workspace selected. Choose a site before using blog review.");
  }
  return siteId;
}

export class BlogReviewService {
  static async reviewBlog(
    blogId: string | undefined,
    data?: ReviewBlogRequest
  ): Promise<{ data: { data: BlogReviewResult } }> {
    const siteId = requireSiteId();
    const endpoint = API_ENDPOINTS.BLOGS.REVIEW(siteId, blogId);
    return apiClient.post(endpoint, data || {});
  }

  static async applyReview(blogId: string | undefined, data: ApplyReviewRequest): Promise<{ data: { data: any } }> {
    if (!blogId) {
      throw new Error("Blog ID is required to apply review");
    }
    const siteId = requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.APPLY_REVIEW(siteId, blogId), data);
  }

  static async applyOne(blogId: string, data: ApplyOneRequest): Promise<{ data: { data: unknown } }> {
    const siteId = requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.APPLY_ONE(siteId, blogId), data);
  }

  static async restoreVersion(blogId: string, version: number): Promise<{ data: { data: unknown } }> {
    const siteId = requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.RESTORE_VERSION(siteId, blogId, version));
  }
}
