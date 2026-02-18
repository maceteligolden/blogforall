import { z } from "zod";
import { BlogStatus } from "../../../shared/constants";

const contentBlockDataSchema = z.object({
  text: z.string().optional(),
  level: z.number().optional(),
  items: z.array(z.string()).optional(),
  listType: z.enum(["bullet", "ordered"]).optional(),
  url: z.string().optional(),
  caption: z.string().optional(),
  language: z.string().optional(),
});

const contentBlockSchema = z.object({
  id: z.string(),
  type: z.enum(["paragraph", "heading", "list", "image", "blockquote", "code"]),
  data: contentBlockDataSchema.optional().default({}),
});

export const createBlogSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
    content: z.string().optional(),
    content_type: z.enum(["html", "markdown"]).optional().default("html"),
    content_blocks: z.array(contentBlockSchema).optional(),
    excerpt: z.string().max(500, "Excerpt must not exceed 500 characters").optional(),
    featured_image: z.string().optional(),
    images: z.array(z.string()).optional(),
    status: z.nativeEnum(BlogStatus).optional().default(BlogStatus.DRAFT),
    category: z.string().optional(),
    dynamic_forms: z.record(z.unknown()).optional(),
    meta: z
      .object({
        description: z.string().max(300, "Meta description must not exceed 300 characters").optional(),
        keywords: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      (Array.isArray(data.content_blocks) && data.content_blocks.length > 0) ||
      (typeof data.content === "string" && data.content.trim().length > 0),
    { message: "Either content or content_blocks is required", path: ["content"] }
  );

export const updateBlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters").optional(),
  content: z.string().min(1, "Content is required").optional(),
  content_type: z.enum(["html", "markdown"]).optional(),
  content_blocks: z.array(contentBlockSchema).optional(),
  excerpt: z.string().max(500, "Excerpt must not exceed 500 characters").optional(),
  featured_image: z.string().optional(),
  images: z.array(z.string()).optional(),
  status: z.nativeEnum(BlogStatus).optional(),
  category: z.string().optional(),
  dynamic_forms: z.record(z.unknown()).optional(),
  meta: z
    .object({
      description: z.string().max(300, "Meta description must not exceed 300 characters").optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
});

export const blogQuerySchema = z.object({
  status: z.nativeEnum(BlogStatus).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
