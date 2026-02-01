import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  parent: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters").optional(),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  parent: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code")
    .optional(),
  is_active: z.boolean().optional(),
});

export const importCategoriesSchema = z.object({
  source_site_id: z.string().min(1, "Source site ID is required"),
  target_site_id: z.string().min(1, "Target site ID is required"),
  category_ids: z.array(z.string().min(1)).min(1, "At least one category ID is required"),
});
