/**
 * Blog Review Configuration Constants
 * Environment variables for AI blog review using HuggingFace
 */

export const BlogReviewConfig = {
  /**
   * HuggingFace API Token - Required for accessing HuggingFace Inference API
   */
  HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || "").trim(),

  /**
   * Model for text generation and review
   * Using a model that can handle instruction following and text analysis
   */
  REVIEW_MODEL: process.env.BLOG_REVIEW_MODEL || "mistralai/Mistral-7B-Instruct-v0.2",

  /**
   * API Timeout - Request timeout in milliseconds
   * Default: 60000 (60 seconds) - longer for review tasks
   */
  API_TIMEOUT: parseInt(process.env.BLOG_REVIEW_API_TIMEOUT || "60000", 10),

  /**
   * Max content length for review (characters)
   * Default: 50000
   */
  MAX_CONTENT_LENGTH: parseInt(process.env.BLOG_REVIEW_MAX_LENGTH || "50000", 10),
};
