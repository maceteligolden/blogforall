import type { PromptAnalysis } from "@/lib/api/services/blog-generation.service";
import {
  type BlogGenerationFormParams,
  getWordCountFromFormParams,
  topicsInputToArray,
} from "@/lib/utils/blog-ai-generation-params";

/** Build API hint object from the settings form (analyze + generate). */
export function formParamsToGenerationHints(p: BlogGenerationFormParams): {
  tone?: string;
  target_audience?: string;
  topics_to_explore?: string[];
  word_count?: number;
  purpose?: string;
  structure?: string;
} {
  const topics = topicsInputToArray(p.topicsInput);
  const word_count = getWordCountFromFormParams(p);
  return {
    tone: p.tone.trim() || undefined,
    target_audience: p.target_audience.trim() || undefined,
    topics_to_explore: topics.length > 0 ? topics : undefined,
    word_count,
    purpose: p.purpose.trim() || undefined,
    structure: p.structure.trim() || undefined,
  };
}

/**
 * Merge API `PromptAnalysis` with form defaults so the confirmation modal
 * shows user choices when the model omitted them.
 */
export function mergePromptAnalysisWithForm(
  analysis: PromptAnalysis,
  form: BlogGenerationFormParams
): PromptAnalysis {
  const hints = formParamsToGenerationHints(form);
  const topics = hints.topics_to_explore ?? analysis.topics_to_explore;
  return {
    ...analysis,
    word_count: hints.word_count ?? analysis.word_count,
    tone: hints.tone ?? analysis.tone,
    target_audience: hints.target_audience || analysis.target_audience,
    topics_to_explore: topics?.length ? topics : analysis.topics_to_explore,
    purpose: hints.purpose || analysis.purpose,
    structure: hints.structure || analysis.structure,
  };
}
