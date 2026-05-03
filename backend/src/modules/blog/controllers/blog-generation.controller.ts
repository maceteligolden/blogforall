import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogGenerationService } from "../services/blog-generation.service";
import { BlogReviewService } from "../services/blog-review.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { PromptAnalysis } from "../services/blog-generation.service";

@injectable()
export class BlogGenerationController {
  constructor(
    private blogGenerationService: BlogGenerationService,
    private blogReviewService: BlogReviewService
  ) {}

  analyzePrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const { prompt } = req.validatedBody as { prompt: string };
      const analysis = await this.blogGenerationService.analyzePrompt(prompt.trim());
      sendSuccess(res, "Prompt analyzed successfully", analysis);
    } catch (error) {
      next(error);
    }
  };

  generateBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getJwtUserId(req);
      const { prompt, analysis } = req.validatedBody as { prompt: string; analysis?: unknown };

      let promptAnalysis = analysis as PromptAnalysis | undefined;
      if (!promptAnalysis) {
        promptAnalysis = await this.blogGenerationService.analyzePrompt(prompt.trim());
      }

      if (!promptAnalysis.is_valid) {
        return next(
          new BadRequestError(
            promptAnalysis.rejection_reason ||
              "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
          )
        );
      }

      const generatedContent = await this.blogGenerationService.generateBlogContent(prompt.trim(), promptAnalysis);

      let reviewResult = null;
      let reviewError: Error | null = null;
      try {
        reviewResult = await this.blogReviewService.reviewBlog(
          generatedContent.title,
          generatedContent.content,
          generatedContent.excerpt
        );
        logger.info(
          "Auto-review completed successfully",
          { title: generatedContent.title },
          "BlogGenerationController"
        );
      } catch (error) {
        reviewError = error as Error;
        logger.error(
          "Auto-review failed - blog content still generated successfully",
          reviewError,
          {
            title: generatedContent.title,
            contentLength: generatedContent.content.length,
          },
          "BlogGenerationController"
        );
      }

      sendSuccess(res, "Blog content generated successfully", {
        content: generatedContent,
        analysis: promptAnalysis,
        review: reviewResult,
        reviewError: reviewError
          ? {
              message:
                "Content was generated successfully, but automatic review is temporarily unavailable. You can review it manually using the 'Review with AI' button.",
              type: "review_unavailable",
            }
          : undefined,
      });
    } catch (error) {
      next(error);
    }
  };
}
