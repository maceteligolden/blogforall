/**
 * Shared types for LangGraph blog generation.
 */

import type { ContentArchetype } from "./contracts/content-archetype";
import type { ResearchBrief } from "./contracts/research-brief";
import type { StyleProfile, StyleVariant } from "./contracts/style-profile";

export interface BlogUserGenerationParams {
  tone?: string;
  target_audience?: string;
  topics_to_explore?: string[];
  word_count?: number;
  purpose?: string;
  structure?: string;
  /** RAG context pack from workspace memory (brand, rules, episodic). */
  context_pack?: string;
  /** Editor-gate voice format: personal_story | engineering_reflection | productivity | linkedin_post */
  post_format?: string;
  /** Animalz content archetype — orthogonal to post_format voice. */
  content_archetype?: ContentArchetype | string;
  /** Optional style variant override (else auto-resolved). */
  style_variant?: StyleVariant | string;
  /** Resolved style profile for this draft (injected by controller/services). */
  style_profile?: StyleProfile;
  /** Research brief for scoped grounding. */
  research_brief?: ResearchBrief;
  /** User-approved outline sections — skip LLM outline when drafting sectionally. */
  approved_outline_sections?: Array<{ heading: string; summary: string }>;
  approved_outline_title?: string;
  site_id?: string;
  personal_notes?: string;
  must_include?: string;
  must_avoid?: string;
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
  post_format?: string;
  content_archetype?: ContentArchetype | string;
  style_variant?: StyleVariant | string;
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
