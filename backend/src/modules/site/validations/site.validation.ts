import { z } from "zod";
import { normalizeWebsiteUrl } from "../../orchestrator/utils/website-onboarding.helper";

const websiteUrlField = z
  .string()
  .min(3, "Website URL is required")
  .max(500)
  .transform((raw, ctx) => {
    const normalized = normalizeWebsiteUrl(raw.trim());
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid website URL (e.g. https://example.com)" });
      return z.NEVER;
    }
    return normalized;
  });

export const createSiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters"),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  website_url: websiteUrlField,
});

export const updateSiteSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters").optional(),
  description: z.string().max(500, "Description must not exceed 500 characters").optional(),
  website_url: websiteUrlField.optional(),
});

export const ensureDefaultWorkspaceSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100, "Name must not exceed 100 characters").optional(),
    website_url: websiteUrlField.optional(),
  })
  .default({});

export const siteIdParamSchema = z.object({
  id: z.string().min(1, "Site ID is required"),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type EnsureDefaultWorkspaceInput = z.infer<typeof ensureDefaultWorkspaceSchema>;
export type SiteIdParam = z.infer<typeof siteIdParamSchema>;
