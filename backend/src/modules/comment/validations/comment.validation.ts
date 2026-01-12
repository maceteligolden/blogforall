import { z } from "zod";

export const createCommentSchema = z.object({
  blog: z.string().min(1, "Blog ID is required"),
  author_name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  author_email: z.string().email("Invalid email address").optional().or(z.literal("")),
  content: z.string().min(1, "Comment content is required").max(2000, "Comment must not exceed 2000 characters"),
  parent_comment: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment content is required")
    .max(2000, "Comment must not exceed 2000 characters")
    .optional(),
  is_approved: z.boolean().optional(),
});

export const commentQuerySchema = z.object({
  blog: z.string().optional(),
  author_id: z.string().optional(),
  is_approved: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
