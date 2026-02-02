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
      throw new BadRequestError(
        "AI blog generation is currently unavailable. Please contact support or try again later."
      );
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new BadRequestError(
        "Please enter a prompt describing what you'd like to write about. For example: 'Write a guide about React hooks for beginners'."
      );
    }

    if (prompt.length > BlogGenerationConfig.MAX_PROMPT_LENGTH) {
      throw new BadRequestError(
        `Your prompt is too long (${prompt.length} characters). Please keep it under ${BlogGenerationConfig.MAX_PROMPT_LENGTH} characters. Try summarizing your request or breaking it into smaller parts.`
      );
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
          rejection_reason: "Your prompt contains content that doesn't meet our guidelines. Please provide a different topic or rephrase your request.",
        };
      }

      // Analyze prompt using AI with timeout, retry, and fallback models
      const analysisPrompt = this.createAnalysisPrompt(prompt);
      const analysisResponse = await this.withRetry(
        () =>
          this.withFallbackModels(
            BlogGenerationConfig.ANALYSIS_MODEL,
            BlogGenerationConfig.ANALYSIS_FALLBACK_MODELS,
            (model) =>
              this.withTimeout(
                this.hf.textGeneration({
                  model,
                  inputs: analysisPrompt,
                  parameters: {
                    max_new_tokens: 500,
                    temperature: 0.3,
                    return_full_text: false,
                  },
                } as any),
                BlogGenerationConfig.API_TIMEOUT,
                "Prompt analysis"
              ),
            "Prompt analysis"
          ),
        "Prompt analysis"
      );

      const analysisText = typeof analysisResponse === "string" ? analysisResponse : analysisResponse.generated_text || "";
      const analysis = this.parseAnalysisResponse(analysisText, prompt);

      // Validate that we have a clear topic
      if (!analysis.topic || analysis.topic.trim().length === 0) {
        return {
          ...analysis,
          is_valid: false,
          rejection_reason: "We couldn't identify a clear topic from your prompt. Please be more specific. For example: 'Write about React hooks' instead of 'write something'.",
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
      
      const errorMessage = (error as Error).message.toLowerCase();
      
      // Provide user-friendly error messages based on error type
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new BadRequestError(
          "The analysis took too long. Please try again with a shorter or more specific prompt."
        );
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        throw new BadRequestError(
          "Unable to connect to the AI service. Please check your internet connection and try again."
        );
      } else if (errorMessage.includes("unauthorized") || errorMessage.includes("401")) {
        throw new BadRequestError(
          "AI service authentication failed. Please contact support if this issue persists."
        );
      } else {
        throw new BadRequestError(
          "We couldn't analyze your prompt. Please try rephrasing it or make it more specific about what you want to write about."
        );
      }
    }
  }

  /**
   * Generate blog post content from prompt
   */
  async generateBlogContent(prompt: string, analysis: PromptAnalysis): Promise<GeneratedBlogContent> {
    if (!BlogGenerationConfig.HUGGINGFACE_API_TOKEN) {
      throw new BadRequestError(
        "AI blog generation is currently unavailable. Please contact support or try again later."
      );
    }

    if (!analysis.is_valid) {
      throw new BadRequestError(
        analysis.rejection_reason || 
        "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
      );
    }

    try {
      const generationPrompt = this.createGenerationPrompt(prompt, analysis);
      const generationResponse = await this.withRetry(
        () =>
          this.withFallbackModels(
            BlogGenerationConfig.GENERATION_MODEL,
            BlogGenerationConfig.GENERATION_FALLBACK_MODELS,
            (model) =>
              this.withTimeout(
                this.hf.textGeneration({
                  model,
                  inputs: generationPrompt,
                  parameters: {
                    max_new_tokens: 3000,
                    temperature: 0.7, // Higher temperature for more creative content
                    return_full_text: false,
                  },
                } as any),
                BlogGenerationConfig.API_TIMEOUT,
                "Blog content generation"
              ),
            "Blog content generation"
          ),
        "Blog content generation"
      );

      const generatedText = typeof generationResponse === "string" ? generationResponse : generationResponse.generated_text || "";
      const blogContent = this.parseGeneratedContent(generatedText, analysis);

      // Validate generated content
      this.validateGeneratedContent(blogContent, analysis);

      // Validate generated content safety
      const isInappropriate = await this.checkContentSafety(blogContent.content);
      if (isInappropriate) {
        throw new BadRequestError(
          "The generated content doesn't meet our content guidelines. Please try a different prompt or topic."
        );
      }

      logger.info("Blog content generated", { topic: analysis.topic, wordCount: blogContent.content.split(/\s+/).length }, "BlogGenerationService");

      return blogContent;
    } catch (error) {
      logger.error("Failed to generate blog content", error as Error, { topic: analysis.topic }, "BlogGenerationService");
      
      // Don't re-throw BadRequestError (already user-friendly)
      if (error instanceof BadRequestError) {
        throw error;
      }
      
      const errorMessage = (error as Error).message.toLowerCase();
      
      // Provide user-friendly error messages based on error type
      if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
        throw new BadRequestError(
          "Blog generation took too long. Please try again with a shorter prompt or reduce the requested word count."
        );
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        throw new BadRequestError(
          "Unable to connect to the AI service. Please check your internet connection and try again."
        );
      } else if (errorMessage.includes("unauthorized") || errorMessage.includes("401")) {
        throw new BadRequestError(
          "AI service authentication failed. Please contact support if this issue persists."
        );
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new BadRequestError(
          "Too many requests. Please wait a moment and try again."
        );
      } else {
        throw new BadRequestError(
          "We couldn't generate your blog post. Please try again with a different prompt or contact support if the issue continues."
        );
      }
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

      // Safety check doesn't need retry - if it fails, allow content (fail open)
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
      ).catch(() => {
        // If safety check fails, return safe response (fail open)
        return { generated_text: "SAFE" };
      });

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
        rejection_reason: hasClearTopic === false 
          ? "Your prompt doesn't contain a clear topic for a blog post. Please specify what you'd like to write about. For example: 'Write a guide about TypeScript basics' or 'Explain how to use React hooks'."
          : undefined,
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
        rejection_reason: originalPrompt.trim().length <= 10 
          ? "Your prompt is too short. Please provide more details about what you'd like to write about. For example: 'Write a comprehensive guide about React hooks for beginners'."
          : undefined,
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
      
      // Validate fallback content before returning
      if (!responseText || responseText.trim().length < BlogGenerationConfig.MIN_CONTENT_LENGTH) {
        throw new BadRequestError(
          "The AI response couldn't be parsed and the content is too short. Please try regenerating with a different prompt."
        );
      }

      // Fallback: return basic structure with validation
      const fallbackContent = {
        title: `Blog Post About ${analysis.topic}`,
        content: responseText,
        excerpt: responseText.substring(0, 150),
        meta: {
          description: responseText.substring(0, 160),
          keywords: [],
        },
      };

      // Validate fallback content
      try {
        this.validateGeneratedContent(fallbackContent, analysis);
      } catch (validationError) {
        // If fallback also fails validation, throw the validation error
        throw validationError;
      }

      return fallbackContent;
    }
  }

  /**
   * Validate generated content (length, structure, etc.)
   */
  private validateGeneratedContent(content: GeneratedBlogContent, analysis: PromptAnalysis): void {
    // Validate title
    if (!content.title || content.title.trim().length === 0) {
      throw new BadRequestError(
        "The generated blog post is missing a title. Please try regenerating or provide a more specific prompt."
      );
    }

    if (content.title.length > 200) {
      throw new BadRequestError(
        `The generated title is too long (${content.title.length} characters). Please try regenerating with a different prompt.`
      );
    }

    // Validate content length
    if (!content.content || content.content.trim().length === 0) {
      throw new BadRequestError(
        "No content was generated. Please try again with a more detailed prompt or a different topic."
      );
    }

    const contentLength = content.content.trim().length;
    const minLength = BlogGenerationConfig.MIN_CONTENT_LENGTH;
    const maxLength = BlogGenerationConfig.MAX_CONTENT_LENGTH;

    if (contentLength < minLength) {
      const wordCount = content.content.split(/\s+/).filter((w) => w.length > 0).length;
      throw new BadRequestError(
        `The generated content is too short (${wordCount} words, ${contentLength} characters). ` +
        `Please try again with a more detailed prompt, specify a longer word count, or ask for more comprehensive coverage of the topic.`
      );
    }

    if (contentLength > maxLength) {
      logger.warn("Generated content exceeds maximum length", { contentLength, maxLength }, "BlogGenerationService");
      // Don't throw error, just log warning - content is still usable
    }

    // Validate word count matches request (with tolerance)
    if (analysis.word_count) {
      const actualWordCount = content.content.split(/\s+/).filter((w) => w.length > 0).length;
      const requestedWordCount = analysis.word_count;
      const tolerance = Math.max(200, requestedWordCount * 0.3); // 30% tolerance or minimum 200 words

      if (actualWordCount < requestedWordCount - tolerance) {
        throw new BadRequestError(
          `The generated content is shorter than requested. You asked for approximately ${requestedWordCount} words, ` +
          `but got ${actualWordCount} words. Please try regenerating with a more detailed prompt or ask for more comprehensive coverage.`
        );
      }

      if (actualWordCount > requestedWordCount + tolerance * 2) {
        logger.warn(
          "Generated content significantly exceeds requested word count",
          { requestedWordCount, actualWordCount },
          "BlogGenerationService"
        );
        // Don't throw error, just log warning - more content is usually fine
      }
    }

    // Validate HTML structure (basic check)
    const htmlTagCount = (content.content.match(/<[^>]+>/g) || []).length;
    const textContent = content.content.replace(/<[^>]+>/g, "").trim();
    
    if (htmlTagCount > 0 && textContent.length < minLength * 0.5) {
      // If HTML is present but actual text content is very short, might be malformed
      logger.warn(
        "Generated content may have HTML structure issues",
        { htmlTagCount, textContentLength: textContent.length },
        "BlogGenerationService"
      );
    }

    // Validate excerpt
    if (content.excerpt && content.excerpt.length > 500) {
      logger.warn("Generated excerpt exceeds recommended length", { excerptLength: content.excerpt.length }, "BlogGenerationService");
      // Truncate excerpt if too long
      content.excerpt = content.excerpt.substring(0, 497) + "...";
    }

    // Validate meta description if present
    if (content.meta?.description && content.meta.description.length > 160) {
      logger.warn("Meta description exceeds recommended length", { descriptionLength: content.meta.description.length }, "BlogGenerationService");
      // Truncate meta description if too long
      content.meta.description = content.meta.description.substring(0, 157) + "...";
    }
  }

  /**
   * Try multiple models in sequence (fallback if primary fails)
   */
  private async withFallbackModels<T>(
    primaryModel: string,
    fallbackModels: string[],
    operation: (model: string) => Promise<T>,
    operationName: string
  ): Promise<T> {
    const allModels = [primaryModel, ...fallbackModels];
    let lastError: Error | null = null;

    for (let i = 0; i < allModels.length; i++) {
      const model = allModels[i];
      const isPrimary = i === 0;

      try {
        if (!isPrimary) {
          logger.info(
            `Trying fallback model for ${operationName}`,
            { model, previousModel: allModels[i - 1] },
            "BlogGenerationService"
          );
        }
        return await operation(model);
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        // Don't try fallback for certain errors (validation, auth, etc.)
        if (
          errorMessage.includes("invalid") ||
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("forbidden") ||
          errorMessage.includes("bad request") ||
          errorMessage.includes("too long") ||
          errorMessage.includes("too short") ||
          errorMessage.includes("inappropriate")
        ) {
          throw error;
        }

        // If this is the last model, throw the error
        if (i === allModels.length - 1) {
          logger.error(
            `All models failed for ${operationName}`,
            lastError,
            { models: allModels },
            "BlogGenerationService"
          );
          throw lastError;
        }

        // Log fallback attempt
        logger.warn(
          `Model ${model} failed for ${operationName}, trying next model...`,
          { error: lastError.message, nextModel: allModels[i + 1] },
          "BlogGenerationService"
        );
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError || new Error(`All models failed for ${operationName}`);
  }

  /**
   * Retry a promise with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = BlogGenerationConfig.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        const errorMessage = lastError.message.toLowerCase();

        // Don't retry on certain errors
        if (
          errorMessage.includes("invalid") ||
          errorMessage.includes("unauthorized") ||
          errorMessage.includes("forbidden") ||
          errorMessage.includes("bad request") ||
          errorMessage.includes("too long") ||
          errorMessage.includes("too short") ||
          errorMessage.includes("inappropriate")
        ) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          BlogGenerationConfig.INITIAL_RETRY_DELAY * Math.pow(2, attempt),
          BlogGenerationConfig.MAX_RETRY_DELAY
        );

        logger.warn(
          `${operationName} failed, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`,
          { error: lastError.message, delay },
          "BlogGenerationService"
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries exhausted
    logger.error(
      `${operationName} failed after ${maxRetries + 1} attempts`,
      lastError as Error,
      {},
      "BlogGenerationService"
    );
    throw lastError;
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
        const operationName = operation.toLowerCase().includes("analysis") 
          ? "analyzing your prompt"
          : operation.toLowerCase().includes("generation") || operation.toLowerCase().includes("generating")
          ? "generating your blog post"
          : operation.toLowerCase();
        
        reject(
          new BadRequestError(
            `The ${operationName} took too long (over ${timeoutMs / 1000} seconds). Please try again with a shorter prompt, reduce the word count, or try a different topic.`
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
