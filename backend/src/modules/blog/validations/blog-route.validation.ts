import { z } from "zod";
import { blogQuerySchema, createBlogSchema, updateBlogSchema, scheduleBlogSchema } from "./blog.validation";

/** From parent mount `/sites/:siteId/blogs` with `mergeParams`. */
export const siteIdParamSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
});

export const siteAndBlogIdParamSchema = z.object({
  siteId: z.string().min(1),
  id: z.string().min(1, "Blog id is required"),
});

export const siteAndSlugParamSchema = z.object({
  siteId: z.string().min(1),
  slug: z.string().min(1, "Slug is required"),
});

export const siteBlogIdParamSchema = z.object({
  siteId: z.string().min(1),
  blogId: z.string().min(1, "Blog id is required"),
});

export const siteBlogVersionParamSchema = z.object({
  siteId: z.string().min(1),
  blogId: z.string().min(1),
  version: z.string().min(1, "Version is required"),
});

export { blogQuerySchema, createBlogSchema, updateBlogSchema, scheduleBlogSchema };

const lengthPresetEnum = z.enum(["short", "medium", "long"]);

const blogGenerationUserHintsSchema = z.object({
  tone: z.string().max(120).optional(),
  target_audience: z.string().max(200).optional(),
  topics_to_explore: z.array(z.string().max(200)).max(20).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  length_preset: lengthPresetEnum.optional(),
  purpose: z.string().max(120).optional(),
  structure: z.string().max(120).optional(),
});

export const blogGenerationAnalyzeBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  tone: z.string().max(120).optional(),
  target_audience: z.string().max(200).optional(),
  topics_to_explore: z.array(z.string().max(200)).max(20).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  /** If set and `word_count` is omitted, maps to ~800 / ~1500 / ~2500 words. */
  length_preset: lengthPresetEnum.optional(),
  purpose: z.string().max(120).optional(),
  structure: z.string().max(120).optional(),
  /** Alternative to flat fields */
  user_params: blogGenerationUserHintsSchema.optional(),
});

export const blogGenerationBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  analysis: z.unknown().optional(),
  tone: z.string().max(120).optional(),
  target_audience: z.string().max(200).optional(),
  topics_to_explore: z.array(z.string().max(200)).max(20).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  length_preset: lengthPresetEnum.optional(),
  purpose: z.string().max(120).optional(),
  structure: z.string().max(120).optional(),
  user_params: blogGenerationUserHintsSchema.optional(),
});

/** Review payload when editing an existing draft (optional fields). */
export const blogReviewBodySchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    excerpt: z.string().optional(),
    category: z.string().optional(),
    content_blocks: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const applyReviewBodySchema = z.object({
  suggestions: z.unknown().optional(),
  improved_content: z.string().optional(),
  improved_title: z.string().optional(),
  improved_excerpt: z.string().optional(),
});

export const applyOneBodySchema = z.object({
  suggestion_id: z.string().optional(),
  target: z.enum(["title", "excerpt", "content"]),
  original: z.string().min(1),
  suggestion: z.string(),
  blockId: z.string().optional(),
  blockIndex: z.coerce.number().optional(),
});
