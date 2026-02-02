import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface PromptAnalysis {
  topic: string;
  domain: string;
  target_audience: string;
  purpose: string;
  structure?: string;
  word_count?: number;
  is_valid: boolean;
  rejection_reason?: string;
}

export interface GeneratedBlogContent {
  title: string;
  content: string;
  excerpt: string;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface GenerateBlogResponse {
  content: GeneratedBlogContent;
  analysis: PromptAnalysis;
  review?: any; // BlogReviewResult from review service
}

export interface AnalyzePromptRequest {
  prompt: string;
}

export interface GenerateBlogRequest {
  prompt: string;
  analysis?: PromptAnalysis; // Optional - will analyze if not provided
}

export class BlogGenerationService {
  /**
   * Analyze a prompt to extract topic, domain, audience, purpose
   */
  static async analyzePrompt(prompt: string): Promise<{ data: { data: PromptAnalysis } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.GENERATE_ANALYZE, { prompt });
  }

  /**
   * Generate blog content from prompt
   */
  static async generateBlog(
    prompt: string,
    analysis?: PromptAnalysis
  ): Promise<{ data: { data: GenerateBlogResponse } }> {
    return apiClient.post(API_ENDPOINTS.BLOGS.GENERATE, {
      prompt,
      analysis,
    });
  }
}
