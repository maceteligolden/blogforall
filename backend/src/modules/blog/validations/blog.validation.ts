import { z } from "zod";
import { BlogStatus } from "../../../shared/constants";

export const createBlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters"),
  content: z.string().min(1, "Content is required"),
  content_type: z.enum(["html", "markdown"]).optional().default("html"),
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
});

export const updateBlogSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must not exceed 200 characters").optional(),
  content: z.string().min(1, "Content is required").optional(),
  content_type: z.enum(["html", "markdown"]).optional(),
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

