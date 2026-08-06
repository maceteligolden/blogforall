import { z } from "zod";
import { BUSINESS_MODELS } from "../types/business-profile";

export const customerPersonaSchema = z.object({
  who: z.string().min(1).max(4000),
  pain_points: z.string().max(4000).optional(),
  success: z.string().max(4000).optional(),
  label: z.string().max(200).optional(),
});

export const competitorEntrySchema = z.object({
  name: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export const businessModelSchema = z.enum(BUSINESS_MODELS);

/** Partial strategic patch fields (updateMemory / PATCH). */
export const strategicPatchSchema = z
  .object({
    website_url: z.string().max(2048).optional(),
    industries: z.array(z.string().min(1).max(100)).max(20).optional(),
    business_model: businessModelSchema.optional(),
    business_description: z.string().max(8000).optional(),
    /** @deprecated Prefer business_description */
    business_type: z.string().max(200).optional(),
    target_audience: z.array(z.string()).max(20).optional(),
    customers: z.array(customerPersonaSchema).max(20).optional(),
    brand_voice: z.string().max(4000).optional(),
    brand_negatives: z.string().max(4000).optional(),
    business_goals: z.array(z.string()).max(20).optional(),
    seo_priorities: z.array(z.string()).max(50).optional(),
    publishing_channels: z.array(z.string()).max(20).optional(),
    competitors: z.array(competitorEntrySchema).max(30).optional(),
    /** @deprecated Prefer competitors */
    competitive_notes: z.string().max(4000).optional(),
  })
  .partial();

/** Required fields for completeOnboarding. */
export const completeOnboardingStrategicSchema = z.object({
  website_url: z.string().max(2048).optional(),
  industries: z.array(z.string().min(1).max(100)).max(20).optional(),
  business_model: businessModelSchema.optional(),
  business_description: z.string().min(1).max(8000),
  target_audience: z.array(z.string().min(1)).max(20).optional(),
  customers: z.array(customerPersonaSchema).min(1).max(20),
  brand_voice: z.string().min(1).max(4000),
  brand_negatives: z.string().max(4000).optional(),
  business_goals: z.array(z.string().min(1)).min(1).max(20),
  seo_priorities: z.array(z.string()).max(50).optional(),
  publishing_channels: z.array(z.string()).max(20).optional(),
  competitors: z.array(competitorEntrySchema).max(30).optional(),
});
