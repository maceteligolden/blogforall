import { injectable } from "tsyringe";
import { HfInference } from "@huggingface/inference";
import { BlogReviewConfig } from "../../../shared/constants/blog-review.constant";
import { logger } from "../../../shared/utils/logger";
import { BadRequestError } from "../../../shared/errors";

export interface ReviewSuggestion {
  type: "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "other";
  priority: "critical" | "important" | "nice-to-have";
  line?: number;
  section?: string;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface BlogReviewResult {
  overall_score: number; // 0-100
  scores: {
    readability: number;
    seo: number;
    grammar: number;
    structure: number;
    fact_check: number;
    style: number;
  };
  suggestions: ReviewSuggestion[];
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
  summary: string;
}

@injectable()
export class BlogReviewService {
  private hf: HfInference;

  constructor() {
    const token = BlogReviewConfig.HUGGINGFACE_API_TOKEN;
    if (!token) {
      logger.warn("HUGGINGFACE_API_TOKEN not set. Blog review will not work.", {}, "BlogReviewService");
    }
    this.hf = new HfInference(token);
  }

  /**
   * Review a blog post using AI
   */
  async reviewBlog(title: string, content: string, excerpt?: string, category?: string): Promise<BlogReviewResult> {
    if (!BlogReviewConfig.HUGGINGFACE_API_TOKEN) {
      throw new BadRequestError("AI review service is not configured. Please set HUGGINGFACE_API_TOKEN.");
    }

    if (!title || !content) {
      throw new BadRequestError("Title and content are required for review");
    }

    if (content.length > BlogReviewConfig.MAX_CONTENT_LENGTH) {
      throw new BadRequestError(`Content is too long. Maximum length is ${BlogReviewConfig.MAX_CONTENT_LENGTH} characters.`);
    }

    try {
      // Strip HTML tags for analysis (keep structure info)
      const textContent = this.stripHtmlTags(content);
      const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

      // Create comprehensive review prompt
      const reviewPrompt = this.createReviewPrompt(title, textContent, excerpt, category, wordCount);

      // Call HuggingFace model for review
      const reviewResponse = await this.hf.textGeneration({
        model: BlogReviewConfig.REVIEW_MODEL,
        inputs: reviewPrompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.3, // Lower temperature for more consistent, factual output
          return_full_text: false,
        },
      });

      const reviewText = typeof reviewResponse === "string" ? reviewResponse : reviewResponse.generated_text || "";

      // Parse the review response
      const reviewResult = this.parseReviewResponse(reviewText, content, title, excerpt);

      logger.info("Blog review completed", { title, wordCount, overallScore: reviewResult.overall_score }, "BlogReviewService");

      return reviewResult;
    } catch (error) {
      logger.error("Failed to review blog", error as Error, { title }, "BlogReviewService");
      throw new BadRequestError(`Failed to review blog: ${(error as Error).message}`);
    }
  }

  /**
   * Strip HTML tags but preserve structure information
   */
  private stripHtmlTags(html: string): string {
    // Replace common HTML elements with text equivalents
    let text = html
      .replace(/<h1[^>]*>/gi, "\n# ")
      .replace(/<h2[^>]*>/gi, "\n## ")
      .replace(/<h3[^>]*>/gi, "\n### ")
      .replace(/<h4[^>]*>/gi, "\n#### ")
      .replace(/<h5[^>]*>/gi, "\n##### ")
      .replace(/<h6[^>]*>/gi, "\n###### ")
      .replace(/<p[^>]*>/gi, "\n")
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, "") // Remove all remaining HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, "\n\n");

    return text;
  }

  /**
   * Create comprehensive review prompt
   */
  private createReviewPrompt(title: string, content: string, excerpt?: string, category?: string, wordCount?: number): string {
    return `You are an expert blog post reviewer. Analyze the following blog post and provide a comprehensive review.

BLOG POST DETAILS:
Title: ${title}
${excerpt ? `Excerpt: ${excerpt}` : ""}
${category ? `Category: ${category}` : ""}
${wordCount ? `Word Count: ${wordCount}` : ""}

CONTENT:
${content}

Please provide a detailed review in the following JSON format:
{
  "overall_score": <number 0-100>,
  "scores": {
    "readability": <number 0-100>,
    "seo": <number 0-100>,
    "grammar": <number 0-100>,
    "structure": <number 0-100>,
    "fact_check": <number 0-100>,
    "style": <number 0-100>
  },
  "suggestions": [
    {
      "type": "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "other",
      "priority": "critical" | "important" | "nice-to-have",
      "line": <optional line number>,
      "section": <optional section name>,
      "original": "<original text>",
      "suggestion": "<improved text>",
      "explanation": "<why this change improves the blog>"
    }
  ],
  "improved_content": "<complete improved version of the content>",
  "improved_title": "<improved title if needed>",
  "improved_excerpt": "<improved excerpt if needed>",
  "summary": "<overall summary of the review>"
}

REVIEW CRITERIA:
1. Readability: Check sentence length, paragraph structure, clarity, and flow
2. SEO: Analyze keyword usage, meta descriptions, headings structure, internal/external linking opportunities
3. Grammar: Check for spelling, grammar, punctuation errors
4. Structure: Evaluate heading hierarchy, paragraph organization, use of lists, images
5. Fact-check: Verify factual claims based on the context (flag potential inaccuracies)
6. Style: Assess tone, voice consistency, engagement level

Provide specific, actionable suggestions with line-by-line feedback where applicable. Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Parse review response from AI model
   */
  private parseReviewResponse(reviewText: string, originalContent: string, originalTitle: string, originalExcerpt?: string): BlogReviewResult {
    try {
      // Try to extract JSON from the response
      let jsonText = reviewText.trim();

      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      // Try to find JSON object
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText) as Partial<BlogReviewResult>;

      // Validate and set defaults
      const result: BlogReviewResult = {
        overall_score: parsed.overall_score ?? 70,
        scores: {
          readability: parsed.scores?.readability ?? 70,
          seo: parsed.scores?.seo ?? 70,
          grammar: parsed.scores?.grammar ?? 70,
          structure: parsed.scores?.structure ?? 70,
          fact_check: parsed.scores?.fact_check ?? 70,
          style: parsed.scores?.style ?? 70,
        },
        suggestions: parsed.suggestions ?? [],
        improved_content: parsed.improved_content || originalContent,
        improved_title: parsed.improved_title || originalTitle,
        improved_excerpt: parsed.improved_excerpt || originalExcerpt,
        summary: parsed.summary || "Review completed. Please check suggestions for improvements.",
      };

      return result;
    } catch (error) {
      logger.error("Failed to parse review response", error as Error, { reviewText: reviewText.substring(0, 200) }, "BlogReviewService");

      // Return a basic review result if parsing fails
      return {
        overall_score: 70,
        scores: {
          readability: 70,
          seo: 70,
          grammar: 70,
          structure: 70,
          fact_check: 70,
          style: 70,
        },
        suggestions: [],
        improved_content: originalContent,
        improved_title: originalTitle,
        improved_excerpt: originalExcerpt,
        summary: "Review completed with basic analysis. AI response parsing encountered an issue.",
      };
    }
  }
}
