import { z } from "zod";
import { blogQuerySchema } from "./blog.validation";

export const publicCategoryQuerySchema = z.object({
  tree: z.enum(["true", "false"]).optional(),
  include_inactive: z.enum(["true", "false"]).optional(),
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string().min(1, "Category id is required"),
});

export const publicBlogIdParamSchema = z.object({
  id: z.string().min(1, "Blog id is required"),
});

export const publicBlogSlugParamSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
});

export { blogQuerySchema };
