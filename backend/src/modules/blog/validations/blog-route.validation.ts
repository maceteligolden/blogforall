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

const lengthPresetEnum = z.enum(["short", "medium", "long", "pillar"]);

const interactivePostTypeEnum = z.enum([
  "article",
  "tutorial",
  "how_to",
  "listicle",
  "opinion",
  "case_study",
  "definitive_guide",
  "software_roundup",
  "comparison",
  "thought_leadership",
]);

const blogGenerationUserHintsSchema = z.object({
  tone: z.string().max(120).optional(),
  target_audience: z.string().max(200).optional(),
  topics_to_explore: z.array(z.string().max(200)).max(20).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  length_preset: lengthPresetEnum.optional(),
  purpose: z.string().max(120).optional(),
  structure: z.string().max(120).optional(),
  post_format: z.string().max(64).optional(),
  content_archetype: z.string().max(64).optional(),
  style_variant: z.string().max(64).optional(),
});

export const blogGenerationAnalyzeBodySchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  tone: z.string().max(120).optional(),
  target_audience: z.string().max(200).optional(),
  topics_to_explore: z.array(z.string().max(200)).max(20).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  /** If set and `word_count` is omitted, maps to ~800 / ~1500 / ~2500 / ~3500 words. */
  length_preset: lengthPresetEnum.optional(),
  purpose: z.string().max(120).optional(),
  structure: z.string().max(120).optional(),
  content_archetype: z.string().max(64).optional(),
  style_variant: z.string().max(64).optional(),
  /** Alternative to flat fields */
  user_params: blogGenerationUserHintsSchema.optional(),
});

export const suggestTopicsBodySchema = z.object({
  seed_intent: z.string().max(1000).optional(),
  campaign_id: z.string().optional(),
  count: z.number().int().min(3).max(8).optional(),
});

export const postEnrichmentSchema = z.object({
  links: z.array(z.string().url().max(2048)).max(5).optional(),
  example_urls: z.array(z.string().url().max(2048)).max(5).optional(),
  personal_notes: z.string().max(5000).optional(),
  must_include: z.string().max(2000).optional(),
  must_avoid: z.string().max(2000).optional(),
  target_audience: z.string().max(200).optional(),
  cta: z.string().max(300).optional(),
  tone: z.string().max(120).optional(),
  length_preset: lengthPresetEnum.optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  style_variant: z.string().max(64).optional(),
});

export const topicSuggestionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(300),
  about: z.string().min(1).max(2000),
  campaign_id: z.string().optional(),
  campaign_name: z.string().max(300).optional(),
  campaign_support: z.string().max(2000),
  keywords: z.array(z.string().max(100)).min(1).max(10),
  post_type: interactivePostTypeEnum,
});

export const postOutlineSchema = z.object({
  working_title: z.string().min(1).max(300),
  thesis: z.string().min(1).max(2000),
  sections: z
    .array(
      z.object({
        id: z.string().optional(),
        heading: z.string().min(1).max(300),
        intent: z.string().min(1).max(2000),
      })
    )
    .min(2)
    .max(12),
  keyword_notes: z.string().max(2000),
  campaign_tie_in: z.string().max(2000),
  post_type: interactivePostTypeEnum,
  keywords: z.array(z.string().max(100)).max(20),
  campaign_id: z.string().optional(),
  style_variant: z.string().max(64).optional(),
  content_archetype: z.string().max(64).optional(),
});

export const outlineBodySchema = z.object({
  topic: topicSuggestionSchema,
  enrichment: postEnrichmentSchema.optional(),
  clarify_choice: z.string().max(500).optional(),
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
  campaign_id: z.string().optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  post_type: interactivePostTypeEnum.optional(),
  /** Voice format only (personal_story, etc.) — not interactive post_type */
  post_format: z.string().max(64).optional(),
  content_archetype: z.string().max(64).optional(),
  style_variant: z.string().max(64).optional(),
  enrichment: postEnrichmentSchema.optional(),
  approved_outline: postOutlineSchema.optional(),
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
