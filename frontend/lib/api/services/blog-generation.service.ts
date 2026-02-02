import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { AxiosRequestConfig } from "axios";

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
  reviewError?: {
    message: string;
    type: string;
  };
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
  static async analyzePrompt(
    prompt: string,
    signal?: AbortSignal
  ): Promise<{ data: { data: PromptAnalysis } }> {
    const config: AxiosRequestConfig = {
      timeout: 120000, // 120 seconds for analysis
      signal, // Support request cancellation
    };
    return apiClient.post(API_ENDPOINTS.BLOGS.GENERATE_ANALYZE, { prompt }, config);
  }

  /**
   * Generate blog content from prompt
   */
  static async generateBlog(
    prompt: string,
    analysis?: PromptAnalysis,
    signal?: AbortSignal
  ): Promise<{ data: { data: GenerateBlogResponse } }> {
    const config: AxiosRequestConfig = {
      timeout: 180000, // 180 seconds for generation (longer timeout)
      signal, // Support request cancellation
    };
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE,
      {
        prompt,
        analysis,
      },
      config
    );
  }
}
