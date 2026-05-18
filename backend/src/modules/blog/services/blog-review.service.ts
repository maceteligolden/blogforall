import { injectable } from "tsyringe";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BlogReviewConfig } from "../../../shared/constants/blog-review.constant";
import { logger } from "../../../shared/utils/logger";
import { BadRequestError } from "../../../shared/errors";
import type { ContentBlock } from "../../../shared/schemas/blog.schema";
import {
  runBlogReviewWithChat,
  type BlogReviewResult,
  type ReviewSuggestion,
  type SuggestionTarget,
  type SuggestionType,
} from "../ai/blog-review.runner";

export type { SuggestionType, SuggestionTarget, ReviewSuggestion, BlogReviewResult };

@injectable()
export class BlogReviewService {
  private getReviewChat(): ChatOpenAI {
    if (!BlogAiConfig.openaiApiKey) {
      throw new BadRequestError(
        "AI review service is not configured. Set OPENAI_API_KEY or BLOG_AI_OPENAI_API_KEY in the server environment."
      );
    }
    return createChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.reviewModel,
      timeout: BlogReviewConfig.API_TIMEOUT,
      temperature: 0.3,
    });
  }

  /**
   * Review a blog post using AI.
   * When content_blocks is provided, suggestions can include blockIndex/blockId for in-context placement.
   */
  async reviewBlog(
    title: string,
    content: string,
    excerpt?: string,
    category?: string,
    content_blocks?: ContentBlock[]
  ): Promise<BlogReviewResult> {
    if (!title || !content) {
      throw new BadRequestError("Title and content are required for review");
    }

    if (content.length > BlogReviewConfig.MAX_CONTENT_LENGTH) {
      throw new BadRequestError(
        `Content is too long. Maximum length is ${BlogReviewConfig.MAX_CONTENT_LENGTH} characters.`
      );
    }

    try {
      const reviewResult = await runBlogReviewWithChat(
        this.getReviewChat(),
        title,
        content,
        excerpt,
        category,
        content_blocks,
        undefined,
        undefined
      );

      const textContent = content.replace(/<[^>]+>/g, " ").trim();
      const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;
      logger.info(
        "Blog review completed",
        { title, wordCount, overallScore: reviewResult.overall_score },
        "BlogReviewService"
      );

      return reviewResult;
    } catch (error) {
      const err = error as Error;
      logger.error("Failed to review blog", err, { title }, "BlogReviewService");
      throw new BadRequestError(`Failed to review blog: ${err.message}`);
    }
  }
}
