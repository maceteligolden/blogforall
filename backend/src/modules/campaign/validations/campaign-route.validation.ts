import { z } from "zod";
import {
  CampaignStatus,
  PostFrequency,
  ScheduledPostStatus,
  CampaignTemplateType,
} from "../../../shared/constants/campaign.constant";

export const siteIdParamSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
});

export const campaignIdParamSchema = z.object({
  siteId: z.string().min(1),
  id: z.string().min(1),
});

export const scheduledPostIdParamSchema = campaignIdParamSchema;

export const templateIdParamSchema = campaignIdParamSchema;

export const templateTypeParamSchema = z.object({
  siteId: z.string().min(1),
  type: z.nativeEnum(CampaignTemplateType),
});

const successMetricsSchema = z
  .object({
    target_views: z.number().optional(),
    target_engagement: z.number().optional(),
    target_conversions: z.number().optional(),
    kpis: z.array(z.string()).optional(),
  })
  .optional();

export const createCampaignBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  goal: z.string().min(1),
  target_audience: z.string().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  posting_frequency: z.nativeEnum(PostFrequency),
  custom_schedule: z.string().optional(),
  timezone: z.string().optional(),
  total_posts_planned: z.number().optional(),
  budget: z.number().optional(),
  success_metrics: successMetricsSchema,
  template_id: z.string().optional(),
});

export const updateCampaignBodySchema = createCampaignBodySchema
  .partial()
  .extend({ status: z.nativeEnum(CampaignStatus).optional() });

export const campaignListQuerySchema = z.object({
  status: z.nativeEnum(CampaignStatus).optional(),
  search: z.string().optional(),
  start_date_from: z.coerce.date().optional(),
  start_date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const campaignDateRangeQuerySchema = z
  .object({
    start_date: z.coerce.date(),
    end_date: z.coerce.date(),
  })
  .refine((q) => q.start_date < q.end_date, {
    message: "end_date must be after start_date",
    path: ["end_date"],
  });

const postMetadataSchema = z
  .object({
    campaign_goal: z.string().optional(),
    target_audience: z.string().optional(),
    content_theme: z.string().optional(),
  })
  .optional();

export const createScheduledPostBodySchema = z.object({
  blog_id: z.string().optional(),
  campaign_id: z.string().optional(),
  title: z.string().min(1),
  scheduled_at: z.coerce.date(),
  timezone: z.string().optional(),
  auto_generate: z.boolean().optional(),
  generation_prompt: z.string().optional(),
  metadata: postMetadataSchema,
});

export const updateScheduledPostBodySchema = z.object({
  blog_id: z.string().optional(),
  title: z.string().optional(),
  scheduled_at: z.coerce.date().optional(),
  timezone: z.string().optional(),
  status: z.nativeEnum(ScheduledPostStatus).optional(),
  generation_prompt: z.string().optional(),
  metadata: postMetadataSchema,
});

export const scheduledPostListQuerySchema = z.object({
  campaign_id: z.string().optional(),
  status: z.nativeEnum(ScheduledPostStatus).optional(),
  scheduled_at_from: z.coerce.date().optional(),
  scheduled_at_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const scheduledPostDateRangeQuerySchema = campaignDateRangeQuerySchema;

export const moveScheduledPostToCampaignBodySchema = z.object({
  campaign_id: z.string().min(1, "Campaign ID is required"),
});

const aiPromptsSchema = z
  .object({
    campaign_strategy: z.string().optional(),
    post_generation: z.string().optional(),
  })
  .optional();

const templateMetadataSchema = z
  .object({
    best_for: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
  })
  .optional();

export const createCampaignTemplateBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(CampaignTemplateType),
  default_goal: z.string().min(1),
  default_duration_days: z.coerce.number().int().min(1).max(365),
  default_frequency: z.nativeEnum(PostFrequency),
  default_posts_count: z.coerce.number().int().min(1),
  suggested_topics: z.array(z.string()).optional(),
  content_themes: z.array(z.string()).optional(),
  ai_prompts: aiPromptsSchema,
  metadata: templateMetadataSchema,
});

export const updateCampaignTemplateBodySchema = createCampaignTemplateBodySchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const campaignTemplateListQuerySchema = z.object({
  type: z.nativeEnum(CampaignTemplateType).optional(),
  is_active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  industry: z.string().optional(),
});

export const agentChatBodySchema = z.object({
  session_id: z.string().optional(),
  message: z.string().min(1, "message is required"),
  site_id: z.string().optional(),
});

const agentProposalCampaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  goal: z.string().min(1),
  target_audience: z.string().optional(),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  posting_frequency: z.nativeEnum(PostFrequency),
  timezone: z.string().optional(),
  total_posts_planned: z.number().optional(),
});

const agentProposalPostSchema = z.object({
  title: z.string().min(1),
  scheduled_at: z.string().min(1),
  timezone: z.string().optional(),
  generation_prompt: z.string().min(1),
  content_theme: z.string().optional(),
});

export const agentCreateFromProposalBodySchema = z.object({
  proposal: z.object({
    campaign: agentProposalCampaignSchema,
    scheduled_posts: z.array(agentProposalPostSchema).min(1),
  }),
});
