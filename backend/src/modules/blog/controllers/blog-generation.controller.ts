import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogGenerationService } from "../services/blog-generation.service";
import { BlogReviewService } from "../services/blog-review.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";

@injectable()
export class BlogGenerationController {
  constructor(
    private blogGenerationService: BlogGenerationService,
    private blogReviewService: BlogReviewService
  ) {}

  /**
   * Analyze prompt to extract topic, domain, audience, purpose
   */
  async analyzePrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { prompt } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return next(
          new BadRequestError(
            "Please enter a prompt describing what you'd like to write about. For example: 'Write a guide about React hooks for beginners'."
          )
        );
      }

      const analysis = await this.blogGenerationService.analyzePrompt(prompt.trim());
      sendSuccess(res, "Prompt analyzed successfully", analysis);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate blog content from prompt
   */
  async generateBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { prompt, analysis } = req.body;

      if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        return next(
          new BadRequestError(
            "Please enter a prompt describing what you'd like to write about. For example: 'Write a guide about React hooks for beginners'."
          )
        );
      }

      // If analysis is provided, use it; otherwise analyze first
      let promptAnalysis = analysis;
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

      // Generate blog content
      const generatedContent = await this.blogGenerationService.generateBlogContent(prompt.trim(), promptAnalysis);

      // Auto-review the generated content
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
        // Log review failure but don't fail the entire generation
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
        // Continue without review - generation was successful
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
  }
}
