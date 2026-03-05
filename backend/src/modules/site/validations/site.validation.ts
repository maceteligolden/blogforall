import { z } from "zod";

export const createSiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
});

export const updateSiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters").optional(),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
});

export const siteIdParamSchema = z.object({
  id: z.string().min(1, "Site ID is required"),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type SiteIdParam = z.infer<typeof siteIdParamSchema>;
