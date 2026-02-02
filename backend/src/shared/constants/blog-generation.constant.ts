/**
 * Blog Generation Configuration Constants
 * Environment variables for AI blog generation using HuggingFace
 */

export const BlogGenerationConfig = {
  /**
   * HuggingFace API Token - Required for accessing HuggingFace Inference API
   */
  HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || "").trim(),

  /**
   * Model for text generation
   * Using a model optimized for instruction following and long-form content
   */
  GENERATION_MODEL: process.env.BLOG_GENERATION_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",

  /**
   * Model for prompt analysis (can be same as generation model)
   */
  ANALYSIS_MODEL: process.env.BLOG_ANALYSIS_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",

  /**
   * API Timeout - Request timeout in milliseconds
   * Default: 120000 (120 seconds) - longer for generation tasks
   */
  API_TIMEOUT: parseInt(process.env.BLOG_GENERATION_API_TIMEOUT || "120000", 10),

  /**
   * Max prompt length (characters)
   * Default: 2000
   */
  MAX_PROMPT_LENGTH: parseInt(process.env.BLOG_GENERATION_MAX_PROMPT_LENGTH || "2000", 10),

  /**
   * Default word count range
   */
  DEFAULT_MIN_WORDS: parseInt(process.env.BLOG_GENERATION_MIN_WORDS || "1000", 10),
  DEFAULT_MAX_WORDS: parseInt(process.env.BLOG_GENERATION_MAX_WORDS || "2000", 10),

  /**
   * Minimum content length (characters) - reject if generated content is too short
   */
  MIN_CONTENT_LENGTH: parseInt(process.env.BLOG_GENERATION_MIN_CONTENT_LENGTH || "500", 10),

  /**
   * Maximum content length (characters) - warn if exceeded
   */
  MAX_CONTENT_LENGTH: parseInt(process.env.BLOG_GENERATION_MAX_CONTENT_LENGTH || "50000", 10),
};
