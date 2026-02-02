import { injectable } from "tsyringe";
import { HfInference } from "@huggingface/inference";
import { BlogGenerationConfig } from "../../../shared/constants/blog-generation.constant";
import { logger } from "../../../shared/utils/logger";
import { BadRequestError } from "../../../shared/errors";

export interface PromptAnalysis {
  topic: string;
  domain: string;
  target_audience: string;
  purpose: string;
  structure?: string;
  word_count?: number;
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

@injectable()
export class BlogGenerationService {
  private hf: HfInference;

  constructor() {
    const token = BlogGenerationConfig.HUGGINGFACE_API_TOKEN;
    if (!token) {
      logger.warn("HUGGINGFACE_API_TOKEN not set. Blog generation will not work.", {}, "BlogGenerationService");
    }
    this.hf = new HfInference(token);
  }

  /**
   * Analyze prompt to extract topic, domain, audience, purpose, etc.
   */
  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    if (!BlogGenerationConfig.HUGGINGFACE_API_TOKEN) {
      throw new BadRequestError("AI generation service is not configured. Please set HUGGINGFACE_API_TOKEN.");
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new BadRequestError("Prompt is required");
    }

    if (prompt.length > BlogGenerationConfig.MAX_PROMPT_LENGTH) {
      throw new BadRequestError(`Prompt is too long. Maximum length is ${BlogGenerationConfig.MAX_PROMPT_LENGTH} characters.`);
    }

    try {
      // Check for inappropriate content first
      const isInappropriate = await this.checkContentSafety(prompt);
      if (isInappropriate) {
        return {
          topic: "",
          domain: "",
          target_audience: "",
          purpose: "",
          is_valid: false,
          rejection_reason: "The prompt contains inappropriate or harmful content. Please provide a different prompt.",
        };
      }

      // Analyze prompt using AI with timeout
      const analysisPrompt = this.createAnalysisPrompt(prompt);
      const analysisResponse = await this.withTimeout(
        this.hf.textGeneration({
          model: BlogGenerationConfig.ANALYSIS_MODEL,
          inputs: analysisPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.3,
            return_full_text: false,
          },
        } as any),
        BlogGenerationConfig.API_TIMEOUT,
        "Prompt analysis"
      );

      const analysisText = typeof analysisResponse === "string" ? analysisResponse : analysisResponse.generated_text || "";
      const analysis = this.parseAnalysisResponse(analysisText, prompt);

      // Validate that we have a clear topic
      if (!analysis.topic || analysis.topic.trim().length === 0) {
        return {
          ...analysis,
          is_valid: false,
          rejection_reason: "Could not identify a clear topic from your prompt. Please provide a more specific topic or question.",
        };
      }

      // Extract word count from prompt if specified
      const wordCount = this.extractWordCount(prompt);
      if (wordCount) {
        analysis.word_count = wordCount;
      }

      logger.info("Prompt analyzed", { topic: analysis.topic, domain: analysis.domain, isValid: analysis.is_valid }, "BlogGenerationService");

      return analysis;
    } catch (error) {
      logger.error("Failed to analyze prompt", error as Error, { prompt: prompt.substring(0, 100) }, "BlogGenerationService");
      throw new BadRequestError(`Failed to analyze prompt: ${(error as Error).message}`);
    }
  }

  /**
   * Generate blog post content from prompt
   */
  async generateBlogContent(prompt: string, analysis: PromptAnalysis): Promise<GeneratedBlogContent> {
    if (!BlogGenerationConfig.HUGGINGFACE_API_TOKEN) {
      throw new BadRequestError("AI generation service is not configured. Please set HUGGINGFACE_API_TOKEN.");
    }

    if (!analysis.is_valid) {
      throw new BadRequestError(analysis.rejection_reason || "Invalid prompt analysis");
    }

    try {
      const generationPrompt = this.createGenerationPrompt(prompt, analysis);
      const generationResponse = await this.withTimeout(
        this.hf.textGeneration({
          model: BlogGenerationConfig.GENERATION_MODEL,
          inputs: generationPrompt,
          parameters: {
            max_new_tokens: 3000,
            temperature: 0.7, // Higher temperature for more creative content
            return_full_text: false,
          },
        } as any),
        BlogGenerationConfig.API_TIMEOUT,
        "Blog content generation"
      );

      const generatedText = typeof generationResponse === "string" ? generationResponse : generationResponse.generated_text || "";
      const blogContent = this.parseGeneratedContent(generatedText, analysis);

      // Validate generated content safety
      const isInappropriate = await this.checkContentSafety(blogContent.content);
      if (isInappropriate) {
        throw new BadRequestError("Generated content contains inappropriate material. Please try a different prompt.");
      }

      logger.info("Blog content generated", { topic: analysis.topic, wordCount: blogContent.content.split(/\s+/).length }, "BlogGenerationService");

      return blogContent;
    } catch (error) {
      logger.error("Failed to generate blog content", error as Error, { topic: analysis.topic }, "BlogGenerationService");
      throw new BadRequestError(`Failed to generate blog content: ${(error as Error).message}`);
    }
  }

  /**
   * Check content safety (filter inappropriate/harmful content)
   */
  private async checkContentSafety(content: string): Promise<boolean> {
    // Basic keyword-based filtering for inappropriate content
    // In production, you might want to use a dedicated content moderation API
    const inappropriateKeywords: string[] = [
      // Add inappropriate keywords/phrases here
      // This is a basic implementation - consider using a proper content moderation service
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of inappropriateKeywords) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    // Use AI to check for inappropriate content
    try {
      const safetyPrompt = `Analyze the following text and determine if it contains inappropriate, harmful, or offensive content. Respond with only "SAFE" or "UNSAFE".

Text: ${content.substring(0, 500)}

Response:`;

      const safetyResponse = await this.withTimeout(
        this.hf.textGeneration({
          model: BlogGenerationConfig.ANALYSIS_MODEL,
          inputs: safetyPrompt,
          parameters: {
            max_new_tokens: 10,
            temperature: 0.1,
            return_full_text: false,
          },
        } as any),
        10000, // 10 seconds for safety check
        "Content safety check"
      );

      const safetyText = typeof safetyResponse === "string" ? safetyResponse : safetyResponse.generated_text || "";
      return safetyText.trim().toUpperCase().includes("UNSAFE");
    } catch (error) {
      logger.warn("Content safety check failed", { error: (error as Error).message }, "BlogGenerationService");
      // If safety check fails, allow content (fail open)
      return false;
    }
  }

  /**
   * Create prompt for analyzing user input
   */
  private createAnalysisPrompt(userPrompt: string): string {
    return `You are an expert blog content analyst. Analyze the following user prompt and extract key information for blog post generation.

USER PROMPT:
"${userPrompt}"

Analyze this prompt and provide a JSON response with the following structure:
{
  "topic": "<clear, specific topic that can be written about>",
  "domain": "<domain/category like Technology, Health, Finance, Marketing, Education, etc.>",
  "target_audience": "<who would read this: beginners, experts, general public, professionals, students, etc.>",
  "purpose": "<why write this: inform, educate, persuade, entertain, tutorial, opinion, news, etc.>",
  "structure": "<suggested structure format if mentioned, otherwise null>",
  "has_clear_topic": <true if topic is clear and specific, false if vague or random>
}

IMPORTANT:
- If the prompt is random, vague, or not related to a specific topic (e.g., "hello", "what time is it", "write code"), set "has_clear_topic" to false
- Extract the domain from the topic context (e.g., "React hooks" → Technology/Web Development)
- Infer target audience from the prompt (e.g., "for beginners" → beginners, technical terms → experts)
- Determine purpose from intent (e.g., "how to" → tutorial/educate, "why" → opinion/inform)
- If structure is mentioned (e.g., "listicle", "tutorial", "opinion piece"), extract it

Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Create prompt for generating blog content
   */
  private createGenerationPrompt(userPrompt: string, analysis: PromptAnalysis): string {
    const wordCount = analysis.word_count || BlogGenerationConfig.DEFAULT_MAX_WORDS;
    const structure = analysis.structure || "best practice structure for this topic";

    return `You are an expert ${analysis.domain} blogger writing for ${analysis.target_audience}. Your goal is to ${analysis.purpose} about "${analysis.topic}".

USER REQUEST:
"${userPrompt}"

WRITING CONTEXT:
- Domain: ${analysis.domain}
- Target Audience: ${analysis.target_audience}
- Purpose: ${analysis.purpose}
- Structure: ${structure}
- Word Count: Approximately ${wordCount} words

TASK:
Write a comprehensive, well-structured blog post that follows industry best practices for ${analysis.domain} content. Use a ${structure} format.

REQUIREMENTS:
1. Create an engaging, SEO-optimized title (max 60 characters)
2. Write a compelling introduction that hooks the reader
3. Structure content with clear headings and subheadings
4. Use proper formatting (paragraphs, lists, emphasis where appropriate)
5. Include practical examples, insights, or actionable advice
6. Write a strong conclusion that summarizes key points
7. Create a concise excerpt (max 150 words) that summarizes the post
8. Ensure content is accurate, well-researched, and appropriate for ${analysis.target_audience}
9. Use appropriate tone for ${analysis.domain} content targeting ${analysis.target_audience}

OUTPUT FORMAT (JSON):
{
  "title": "<SEO-optimized title>",
  "content": "<Full blog post content in HTML format with proper headings, paragraphs, lists>",
  "excerpt": "<Concise summary, max 150 words>",
  "meta": {
    "description": "<SEO meta description, max 160 characters>",
    "keywords": ["keyword1", "keyword2", "keyword3"]
  }
}

Think step by step:
1. What are the key points to cover about "${analysis.topic}"?
2. What structure would work best for ${analysis.target_audience}?
3. What examples or insights would be most valuable?
4. How can I make this engaging and informative?

Now write the blog post. Return ONLY valid JSON, no additional text.`;
  }

  /**
   * Parse analysis response from AI
   */
  private parseAnalysisResponse(responseText: string, originalPrompt: string): PromptAnalysis {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText) as Partial<PromptAnalysis & { has_clear_topic?: boolean }>;

      const hasClearTopic = (parsed as any).has_clear_topic !== false;

      return {
        topic: parsed.topic || "",
        domain: parsed.domain || "General",
        target_audience: parsed.target_audience || "general public",
        purpose: parsed.purpose || "inform",
        structure: parsed.structure || undefined,
        word_count: parsed.word_count,
        is_valid: hasClearTopic && !!parsed.topic,
        rejection_reason: hasClearTopic === false ? "Prompt does not contain a clear, specific topic suitable for a blog post." : undefined,
      };
    } catch (error) {
      logger.error("Failed to parse analysis response", error as Error, { responseText: responseText.substring(0, 200) }, "BlogGenerationService");
      // Fallback: try to extract topic from original prompt
      return {
        topic: originalPrompt.substring(0, 100),
        domain: "General",
        target_audience: "general public",
        purpose: "inform",
        is_valid: originalPrompt.trim().length > 10,
        rejection_reason: originalPrompt.trim().length <= 10 ? "Prompt is too short or unclear." : undefined,
      };
    }
  }

  /**
   * Parse generated content response
   */
  private parseGeneratedContent(responseText: string, analysis: PromptAnalysis): GeneratedBlogContent {
    try {
      let jsonText = responseText.trim();
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText) as Partial<GeneratedBlogContent>;

      return {
        title: parsed.title || `Blog Post About ${analysis.topic}`,
        content: parsed.content || "",
        excerpt: parsed.excerpt || "",
        meta: parsed.meta || {
          description: parsed.excerpt?.substring(0, 160) || "",
          keywords: [],
        },
      };
    } catch (error) {
      logger.error("Failed to parse generated content", error as Error, { responseText: responseText.substring(0, 200) }, "BlogGenerationService");
      // Fallback: return basic structure
      return {
        title: `Blog Post About ${analysis.topic}`,
        content: responseText,
        excerpt: responseText.substring(0, 150),
        meta: {
          description: responseText.substring(0, 160),
          keywords: [],
        },
      };
    }
  }

  /**
   * Wrap a promise with timeout handling
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new BadRequestError(
            `${operation} timed out after ${timeoutMs / 1000} seconds. Please try again with a shorter prompt or different parameters.`
          )
        );
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Extract word count from prompt if specified
   */
  private extractWordCount(prompt: string): number | undefined {
    // Look for patterns like "500 words", "1000-word", "2000 words", etc.
    const patterns = [
      /(\d+)\s*words?/i,
      /(\d+)\s*word\s*blog/i,
      /approximately\s*(\d+)\s*words?/i,
      /around\s*(\d+)\s*words?/i,
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (count >= 300 && count <= 5000) {
          // Reasonable range
          return count;
        }
      }
    }

    return undefined;
  }
}
