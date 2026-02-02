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
   * Fallback models for generation (tried in order if primary fails)
   */
  GENERATION_FALLBACK_MODELS: (process.env.BLOG_GENERATION_FALLBACK_MODELS || 
    "mistralai/Mixtral-8x7B-Instruct-v0.1,meta-llama/Llama-2-7b-chat-hf").split(",").map(m => m.trim()),

  /**
   * Model for prompt analysis (can be same as generation model)
   */
  ANALYSIS_MODEL: process.env.BLOG_ANALYSIS_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",

  /**
   * Fallback models for analysis (tried in order if primary fails)
   */
  ANALYSIS_FALLBACK_MODELS: (process.env.BLOG_ANALYSIS_FALLBACK_MODELS || 
    "mistralai/Mixtral-8x7B-Instruct-v0.1").split(",").map(m => m.trim()),

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

  /**
   * Retry configuration
   */
  MAX_RETRIES: parseInt(process.env.BLOG_GENERATION_MAX_RETRIES || "3", 10),
  INITIAL_RETRY_DELAY: parseInt(process.env.BLOG_GENERATION_INITIAL_RETRY_DELAY || "1000", 10), // 1 second
  MAX_RETRY_DELAY: parseInt(process.env.BLOG_GENERATION_MAX_RETRY_DELAY || "10000", 10), // 10 seconds
};
