import { z } from "zod";

export const siteIdParamSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
});

export const siteAndCategoryIdParamSchema = z.object({
  siteId: z.string().min(1),
  id: z.string().min(1),
});
