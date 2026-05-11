/**
 * Shared types for LangGraph blog generation.
 */

export interface BlogUserGenerationParams {
  tone?: string;
  target_audience?: string;
  topics_to_explore?: string[];
  word_count?: number;
  purpose?: string;
  structure?: string;
}

export interface PromptAnalysis {
  topic: string;
  domain: string;
  target_audience: string;
  purpose: string;
  structure?: string;
  word_count?: number;
  /** User-selected or inferred tone (e.g. professional, conversational). */
  tone?: string;
  /** Subtopics the user wants covered. */
  topics_to_explore?: string[];
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

export interface ResearchNote {
  url: string;
  title: string;
  snippet: string;
}
