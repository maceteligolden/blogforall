import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";
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
  review?: any;
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
  analysis?: PromptAnalysis;
}

function requireSiteId(): string {
  if (typeof window === "undefined") {
    throw new Error("Blog generation requires a browser context");
  }
  const siteId = useAuthStore.getState().currentSiteId;
  if (!siteId) {
    throw new Error("No workspace selected. Choose a site before generating blogs.");
  }
  return siteId;
}

export class BlogGenerationService {
  static async analyzePrompt(
    prompt: string,
    signal?: AbortSignal
  ): Promise<{ data: { data: PromptAnalysis } }> {
    const siteId = requireSiteId();
    const config: AxiosRequestConfig = {
      timeout: 120000,
      signal,
    };
    return apiClient.post(API_ENDPOINTS.BLOGS.GENERATE_ANALYZE(siteId), { prompt }, config);
  }

  static async generateBlog(
    prompt: string,
    analysis?: PromptAnalysis,
    signal?: AbortSignal
  ): Promise<{ data: { data: GenerateBlogResponse } }> {
    const siteId = requireSiteId();
    const config: AxiosRequestConfig = {
      timeout: 180000,
      signal,
    };
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE(siteId),
      {
        prompt,
        analysis,
      },
      config
    );
  }
}
