/**
 * Blog Review Configuration Constants
 * Environment variables for AI blog review using HuggingFace
 */

export const BlogReviewConfig = {
  /**
   * HuggingFace API Token - Required for Inference API / Inference Providers.
   * Read from HUGGINGFACE_API_TOKEN or HF_TOKEN. Use a token with "Inference" permission
   * (e.g. fine-grained: "Inference > Make calls to the serverless Inference API" or "Inference Providers").
   */
  HUGGINGFACE_API_TOKEN: (process.env.HUGGINGFACE_API_TOKEN || process.env.HF_TOKEN || "").trim(),

  /**
   * Model for chat completion and review. We request provider :hf-inference so your HF token is used.
   * Default is an hf-inference–supported chat model. Override with BLOG_REVIEW_MODEL (e.g. "model:id" or "model:id:provider").
   */
  REVIEW_MODEL: process.env.BLOG_REVIEW_MODEL || "HuggingFaceTB/SmolLM3-3B",

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
