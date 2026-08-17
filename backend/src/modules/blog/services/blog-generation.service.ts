import { injectable } from "tsyringe";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { BlogGenerationGraphService } from "../ai/blog-generation-graph.service";
import type { BlogReviewResult } from "../ai/blog-review.runner";
import type { BlogUserGenerationParams, GeneratedBlogContent, PromptAnalysis, ResearchNote } from "../ai/types";

export type { PromptAnalysis, GeneratedBlogContent, ResearchNote } from "../ai/types";

function formatReviewAsFeedback(review: BlogReviewResult): string {
  const lines: string[] = [];
  if (review.summary?.trim()) {
    lines.push(`Editorial review (overall ${review.overall_score}/10): ${review.summary.trim()}`);
  }
  const suggestions = review.suggestions ?? [];
  for (const suggestion of suggestions.slice(0, 12)) {
    const original = (suggestion.original || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const next = (suggestion.suggestion || "").replace(/\s+/g, " ").trim().slice(0, 160);
    lines.push(
      `- [${suggestion.priority}] ${suggestion.explanation}${original ? ` — was: "${original}"` : ""}${next ? ` → ${next}` : ""}`
    );
  }
  return lines.join("\n").trim();
}

@injectable()
export class BlogGenerationService {
  constructor(private readonly graphService: BlogGenerationGraphService) {}

  async analyzePrompt(prompt: string, userParams?: BlogUserGenerationParams): Promise<PromptAnalysis> {
    this.graphService.assertConfigured();
    if (prompt.length > BlogAiConfig.MAX_PROMPT_LENGTH) {
      throw new BadRequestError(
        `Your prompt is too long (${prompt.length} characters). Please keep it under ${BlogAiConfig.MAX_PROMPT_LENGTH} characters.`
      );
    }
    return this.graphService.analyzePrompt(prompt, userParams);
  }

  async generateBlogContent(
    prompt: string,
    analysis: PromptAnalysis,
    userParams?: BlogUserGenerationParams
  ): Promise<GeneratedBlogContent> {
    const { content } = await this.generateWithReview(prompt, analysis, userParams);
    return content;
  }

  async generateWithReview(
    prompt: string,
    analysis: PromptAnalysis,
    userParams?: BlogUserGenerationParams
  ): Promise<{ content: GeneratedBlogContent; analysis: PromptAnalysis; review: BlogReviewResult }> {
    const first = await this.graphService.generateFull(prompt, analysis, userParams);
    const rewritten = await this.rewriteFromReview(first.content, first.review, userParams);
    return { content: rewritten, analysis: first.analysis, review: first.review };
  }

  /** Writing loop: draft from already-approved research notes, then review + rewrite. No second web research. */
  async generateWithReviewFromNotes(
    prompt: string,
    analysis: PromptAnalysis,
    researchNotes: ResearchNote[],
    userParams?: BlogUserGenerationParams
  ): Promise<{ content: GeneratedBlogContent; analysis: PromptAnalysis; review: BlogReviewResult }> {
    const first = await this.graphService.generateFromNotesWithReview(prompt, analysis, researchNotes, userParams);
    try {
      const rewritten = await this.rewriteFromReview(first.content, first.review, userParams);
      return { content: rewritten, analysis: first.analysis, review: first.review };
    } catch (error) {
      logger.warn(
        "Editorial rewrite failed; keeping first draft",
        { error: error instanceof Error ? error.message : String(error) },
        "BlogGenerationService"
      );
      return first;
    }
  }

  /** Apply editorial review notes so the user never sees the pre-review draft. */
  private async rewriteFromReview(
    content: GeneratedBlogContent,
    review: BlogReviewResult,
    userParams?: BlogUserGenerationParams
  ): Promise<GeneratedBlogContent> {
    const feedback = formatReviewAsFeedback(review);
    if (!feedback) return content;
    return this.graphService.regenerateWithFeedback({
      title: content.title,
      content: content.content,
      excerpt: content.excerpt,
      feedback,
      userParams,
    });
  }

  /**
   * Revise an existing blog draft using reviewer comments. Used by the
   * scheduled-post rework loop: a workspace owner asks for changes via the
   * review email, the orchestrator's prepare service re-runs preparation
   * for the next rework round, and this method is what produces the new
   * draft. No research / editorial review is run since the reviewer's
   * notes ARE the editorial signal.
   */
  async regenerateWithFeedback(input: {
    title: string;
    content: string;
    excerpt?: string;
    feedback: string;
    userParams?: BlogUserGenerationParams;
  }): Promise<GeneratedBlogContent> {
    return this.graphService.regenerateWithFeedback(input);
  }

  streamGenerate(
    prompt: string,
    analysis: PromptAnalysis,
    userParams: BlogUserGenerationParams | undefined,
    signal: AbortSignal | undefined,
    emit: (event: string, data: unknown) => void
  ): Promise<{ content: GeneratedBlogContent; analysis: PromptAnalysis; review: BlogReviewResult }> {
    return this.graphService.streamGenerate(prompt, analysis, userParams, signal, emit);
  }
}
