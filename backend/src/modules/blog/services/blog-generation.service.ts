import { injectable } from "tsyringe";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BadRequestError } from "../../../shared/errors";
import { BlogGenerationGraphService } from "../ai/blog-generation-graph.service";
import type { BlogReviewResult } from "../ai/blog-review.runner";
import type { BlogUserGenerationParams, GeneratedBlogContent, PromptAnalysis } from "../ai/types";

export type { PromptAnalysis, GeneratedBlogContent } from "../ai/types";

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
    const { content } = await this.graphService.generateFull(prompt, analysis, userParams);
    return content;
  }

  async generateWithReview(
    prompt: string,
    analysis: PromptAnalysis,
    userParams?: BlogUserGenerationParams
  ): Promise<{ content: GeneratedBlogContent; analysis: PromptAnalysis; review: BlogReviewResult }> {
    return this.graphService.generateFull(prompt, analysis, userParams);
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
