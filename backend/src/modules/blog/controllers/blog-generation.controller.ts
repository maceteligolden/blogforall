import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogGenerationService } from "../services/blog-generation.service";
import { BlogReviewService } from "../services/blog-review.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";

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
        return next(new BadRequestError("Prompt is required"));
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
        return next(new BadRequestError("Prompt is required"));
      }

      // If analysis is provided, use it; otherwise analyze first
      let promptAnalysis = analysis;
      if (!promptAnalysis) {
        promptAnalysis = await this.blogGenerationService.analyzePrompt(prompt.trim());
      }

      if (!promptAnalysis.is_valid) {
        return next(new BadRequestError(promptAnalysis.rejection_reason || "Invalid prompt"));
      }

      // Generate blog content
      const generatedContent = await this.blogGenerationService.generateBlogContent(prompt.trim(), promptAnalysis);

      // Auto-review the generated content
      let reviewResult = null;
      try {
        reviewResult = await this.blogReviewService.reviewBlog(
          generatedContent.title,
          generatedContent.content,
          generatedContent.excerpt
        );
      } catch (reviewError) {
        // Log but don't fail if review fails
        console.error("Auto-review failed:", reviewError);
      }

      sendSuccess(res, "Blog content generated successfully", {
        content: generatedContent,
        analysis: promptAnalysis,
        review: reviewResult,
      });
    } catch (error) {
      next(error);
    }
  }
}
