import type { BlogReviewResult } from "../../../../blog/ai/blog-review.runner";
import {
  computeOverallScore,
  contentOptimizationReportSchema,
  evaluateQualityGate,
  type ContentOptimizationReport,
  type OptimizationRecommendation,
} from "../../contracts/content-optimization";

/**
 * Temporary adapter (doc 17 §11): map legacy BlogReviewResult → ContentOptimizationReport.
 */
export function mapBlogReviewToOptimizationReport(input: {
  review: BlogReviewResult;
  draft_id?: string;
  research_package_id?: string;
}): ContentOptimizationReport {
  const { review } = input;
  const toPriority = (p: string): OptimizationRecommendation["priority"] => {
    if (p === "critical") return "Critical";
    if (p === "important") return "High";
    return "Low";
  };
  const recommendations: OptimizationRecommendation[] = review.suggestions.map((s, i) => ({
    id: s.id ?? `rev_${i + 1}`,
    priority: toPriority(s.priority),
    dimension: s.type,
    message: s.explanation || s.suggestion,
    target:
      s.target === "title"
        ? "title"
        : s.target === "excerpt"
          ? "excerpt"
          : s.target === "content"
            ? "body"
            : undefined,
    suggested_action: s.suggestion,
  }));
  const critical = recommendations.filter((r) => r.priority === "Critical");
  const high = recommendations.filter((r) => r.priority === "High");
  const medium = recommendations.filter((r) => r.priority === "Medium");
  const low = recommendations.filter((r) => r.priority === "Low");

  const seo = review.scores.seo;
  const readability = review.scores.readability;
  const gao = Math.round((review.scores.seo + review.scores.fact_check) / 2);
  const authority = review.scores.fact_check;
  const ux = review.scores.engagement;
  const factual = review.scores.fact_check;
  const overall = computeOverallScore({
    seo,
    gao,
    authority,
    readability,
    ux,
    factual_confidence: factual,
  });

  return contentOptimizationReportSchema.parse({
    version: 1,
    id: `opt_review_${Date.now()}`,
    draft_id: input.draft_id,
    research_package_id: input.research_package_id,
    created_at: new Date().toISOString(),
    seo: {
      version: 1,
      metrics: [
        {
          name: "legacy_seo",
          score: seo,
          explanation: review.summary,
          issues: [],
          recommendations: [],
        },
      ],
      aggregate: seo,
    },
    gao: {
      version: 1,
      metrics: [
        {
          name: "legacy_gao_proxy",
          score: gao,
          explanation: "Derived from legacy review scores",
          issues: [],
          recommendations: [],
        },
      ],
      aggregate: gao,
    },
    authority: {
      expertise: authority,
      experience: authority,
      authority,
      trust: authority,
      unsupported_claims: [],
      recommendations: [],
    },
    readability: {
      avg_sentence_length: 0,
      avg_paragraph_length: 0,
      aggregate: readability,
      recommendations: [],
    },
    ux: {
      hook_quality: ux,
      pacing: ux,
      section_flow: review.scores.structure,
      cta_effectiveness: ux,
      visual_opportunities: [],
      aggregate: ux,
      recommendations: [],
    },
    validator_results: [
      {
        validator_id: "legacy_blog_review",
        score: review.overall_score,
        passed: evaluateQualityGate(overall, critical.length),
        issues: review.suggestions.map((s) => ({
          code: s.type,
          severity: toPriority(s.priority),
          message: s.explanation,
        })),
        recommendations,
        rationale: "Wrapped blog-review.runner output",
      },
    ],
    plan: {
      version: 1,
      critical,
      high,
      medium,
      low,
      writing_brief: review.summary || "Apply legacy review suggestions.",
    },
    quality: {
      seo,
      gao,
      authority,
      readability,
      ux,
      factual_confidence: factual,
      overall,
      weights: {
        seo: 0.25,
        gao: 0.25,
        authority: 0.15,
        readability: 0.15,
        ux: 0.1,
        factual_confidence: 0.1,
      },
    },
    quality_gate_passed: evaluateQualityGate(overall, critical.length),
  });
}
