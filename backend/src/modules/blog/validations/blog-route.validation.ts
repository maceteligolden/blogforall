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

export const blogGenerationAnalyzeBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

export const blogGenerationBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  analysis: z.unknown().optional(),
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
