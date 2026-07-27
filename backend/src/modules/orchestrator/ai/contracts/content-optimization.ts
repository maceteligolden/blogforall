import { z } from "zod";
import { MVP_LOCKS } from "./mvp-locks";

export const recommendationPrioritySchema = z.enum(["Critical", "High", "Medium", "Low"]);

export const optimizationRecommendationSchema = z.object({
  id: z.string().min(1),
  priority: recommendationPrioritySchema,
  dimension: z.string().min(1),
  message: z.string().min(1),
  target: z.enum(["title", "excerpt", "body", "meta", "structure", "links"]).optional(),
  suggested_action: z.string().optional(),
});

export const validatorResultSchema = z.object({
  validator_id: z.string().min(1),
  score: z.number().min(0).max(100).optional(),
  passed: z.boolean(),
  issues: z.array(
    z.object({
      code: z.string().min(1),
      severity: recommendationPrioritySchema,
      message: z.string().min(1),
      evidence: z.string().optional(),
    }),
  ),
  recommendations: z.array(optimizationRecommendationSchema),
  metrics: z.record(z.union([z.number(), z.string()])).optional(),
  rationale: z.string().optional(),
});

export const metricScoreSchema = z.object({
  name: z.string().min(1),
  score: z.number(),
  explanation: z.string(),
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export const seoScorecardSchema = z.object({
  version: z.literal(1),
  metrics: z.array(metricScoreSchema),
  aggregate: z.number().min(0).max(100),
});

export const gaoScorecardSchema = z.object({
  version: z.literal(1),
  metrics: z.array(metricScoreSchema),
  aggregate: z.number().min(0).max(100),
});

export const authorityReportSchema = z.object({
  expertise: z.number().min(0).max(100),
  experience: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  trust: z.number().min(0).max(100),
  unsupported_claims: z.array(z.string()),
  recommendations: z.array(optimizationRecommendationSchema),
});

export const readabilityReportSchema = z.object({
  reading_level: z.number().optional(),
  avg_sentence_length: z.number(),
  avg_paragraph_length: z.number(),
  passive_voice_ratio: z.number().optional(),
  aggregate: z.number().min(0).max(100),
  recommendations: z.array(optimizationRecommendationSchema),
});

export const uxReportSchema = z.object({
  hook_quality: z.number().min(0).max(100),
  pacing: z.number().min(0).max(100),
  section_flow: z.number().min(0).max(100),
  cta_effectiveness: z.number().min(0).max(100),
  visual_opportunities: z.array(z.string()),
  aggregate: z.number().min(0).max(100),
  recommendations: z.array(optimizationRecommendationSchema),
});

export const optimizationPlanSchema = z.object({
  version: z.literal(1),
  critical: z.array(optimizationRecommendationSchema),
  high: z.array(optimizationRecommendationSchema),
  medium: z.array(optimizationRecommendationSchema),
  low: z.array(optimizationRecommendationSchema),
  writing_brief: z.string(),
});

export const qualityWeightsSchema = z.object({
  seo: z.literal(0.25),
  gao: z.literal(0.25),
  authority: z.literal(0.15),
  readability: z.literal(0.15),
  ux: z.literal(0.1),
  factual_confidence: z.literal(0.1),
});

export const DEFAULT_QUALITY_WEIGHTS = {
  seo: 0.25,
  gao: 0.25,
  authority: 0.15,
  readability: 0.15,
  ux: 0.1,
  factual_confidence: 0.1,
} as const;

export const qualityScorecardSchema = z.object({
  seo: z.number().min(0).max(100),
  gao: z.number().min(0).max(100),
  authority: z.number().min(0).max(100),
  readability: z.number().min(0).max(100),
  ux: z.number().min(0).max(100),
  factual_confidence: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  weights: qualityWeightsSchema,
});

export const contentMetadataSchema = z
  .object({
    title: z.string().optional(),
    meta_description: z.string().optional(),
    slug: z.string().optional(),
  })
  .passthrough();

export const contentOptimizationReportSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  draft_id: z.string().optional(),
  research_package_id: z.string().optional(),
  created_at: z.string().min(1),
  seo: seoScorecardSchema,
  gao: gaoScorecardSchema,
  authority: authorityReportSchema,
  readability: readabilityReportSchema,
  ux: uxReportSchema,
  validator_results: z.array(validatorResultSchema),
  plan: optimizationPlanSchema,
  quality: qualityScorecardSchema,
  quality_gate_passed: z.boolean(),
  metadata_suggestions: contentMetadataSchema.optional(),
});

export type ContentOptimizationReport = z.infer<typeof contentOptimizationReportSchema>;
export type OptimizationPlan = z.infer<typeof optimizationPlanSchema>;
export type QualityScorecard = z.infer<typeof qualityScorecardSchema>;

export function computeOverallScore(input: {
  seo: number;
  gao: number;
  authority: number;
  readability: number;
  ux: number;
  factual_confidence: number;
}): number {
  const w = DEFAULT_QUALITY_WEIGHTS;
  const overall =
    w.seo * input.seo +
    w.gao * input.gao +
    w.authority * input.authority +
    w.readability * input.readability +
    w.ux * input.ux +
    w.factual_confidence * input.factual_confidence;
  return Math.round(overall * 100) / 100;
}

/** ADR-008 / doc 17: overall >= 72 AND zero Critical planner items. */
export function evaluateQualityGate(
  overall: number,
  criticalCount: number,
  overallMin: number = MVP_LOCKS.optimizeOverallMin,
): boolean {
  return overall >= overallMin && criticalCount === 0;
}

export function canOptimizeAgain(
  optimizeCount: number,
  maxLoops: number = MVP_LOCKS.optimizeMaxLoops,
): boolean {
  return optimizeCount < maxLoops;
}
