import { z } from "zod";

export const funnelStageSchema = z.enum(["awareness", "consideration", "conversion"]);

export const contentStrategyArtifactSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  topic: z.string().min(1),
  business_objective: z.string().min(1),
  target_audience: z.string().min(1),
  search_intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  keyword_clusters: z.array(z.array(z.string().min(1))).min(1),
  content_angle: z.string().min(1),
  funnel_stage: funnelStageSchema,
  topical_authority_opportunities: z.array(z.string()),
  cta: z.string().min(1),
  content_structure: z.array(z.string().min(1)).min(2),
  notes: z.string().optional(),
});

export type ContentStrategyArtifact = z.infer<typeof contentStrategyArtifactSchema>;
