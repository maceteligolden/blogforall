import { randomUUID } from "crypto";
import {
  canOptimizeAgain,
  computeOverallScore,
  contentOptimizationReportSchema,
  evaluateQualityGate,
  type ContentOptimizationReport,
  type OptimizationPlan,
  type OptimizationRecommendation,
  type ValidatorResult,
} from "../../contracts/content-optimization";
import { MVP_LOCKS } from "../../contracts/mvp-locks";

export type DraftForOptimize = {
  title: string;
  content: string;
  excerpt?: string;
  meta_description?: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function paragraphs(html: string): string[] {
  const parts = html
    .split(/<\/p>|<br\s*\/?>|\n\n+/i)
    .map((p) => stripTags(p))
    .filter(Boolean);
  return parts.length ? parts : [stripTags(html)].filter(Boolean);
}

function rec(
  id: string,
  priority: OptimizationRecommendation["priority"],
  dimension: string,
  message: string,
  target?: OptimizationRecommendation["target"]
): OptimizationRecommendation {
  return { id, priority, dimension, message, target };
}

/** Deterministic structural checks (doc 17 MVP). */
export function runStructuralValidator(draft: DraftForOptimize): ValidatorResult {
  const issues: ValidatorResult["issues"] = [];
  const recommendations: OptimizationRecommendation[] = [];
  const text = stripTags(draft.content);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hasH2 = /<h2\b/i.test(draft.content) || /^##\s/m.test(draft.content);
  const titleLen = draft.title.trim().length;

  if (titleLen < 20 || titleLen > 70) {
    issues.push({
      code: "title_length",
      severity: "High",
      message: `Title length ${titleLen} is outside 20–70 chars`,
    });
    recommendations.push(rec("struct_title", "High", "structure", "Tighten title to ~20–70 characters", "title"));
  }
  if (wordCount < 400) {
    issues.push({
      code: "thin_content",
      severity: "Critical",
      message: `Body has only ${wordCount} words`,
    });
    recommendations.push(rec("struct_thin", "Critical", "structure", "Expand body to at least ~400 words", "body"));
  }
  if (!hasH2) {
    issues.push({
      code: "missing_headings",
      severity: "Medium",
      message: "No H2/section headings detected",
    });
    recommendations.push(rec("struct_h2", "Medium", "structure", "Add clear section headings", "structure"));
  }

  const score = Math.max(
    0,
    100 - issues.reduce((a, i) => a + (i.severity === "Critical" ? 30 : i.severity === "High" ? 15 : 8), 0)
  );
  return {
    validator_id: "structural",
    score,
    passed: !issues.some((i) => i.severity === "Critical"),
    issues,
    recommendations,
    metrics: { word_count: wordCount, title_length: titleLen },
  };
}

/** Deterministic readability heuristics. */
export function runReadabilityValidator(draft: DraftForOptimize): ValidatorResult {
  const text = stripTags(draft.content);
  const sents = sentences(text);
  const paras = paragraphs(draft.content);
  const avgSentence = sents.length ? sents.reduce((a, s) => a + s.split(/\s+/).length, 0) / sents.length : 0;
  const avgPara = paras.length ? paras.reduce((a, p) => a + p.split(/\s+/).length, 0) / paras.length : 0;
  const issues: ValidatorResult["issues"] = [];
  const recommendations: OptimizationRecommendation[] = [];
  if (avgSentence > 28) {
    issues.push({
      code: "long_sentences",
      severity: "Medium",
      message: `Average sentence length ${avgSentence.toFixed(1)} words`,
    });
    recommendations.push(rec("read_sent", "Medium", "readability", "Shorten long sentences for scanability", "body"));
  }
  if (avgPara > 120) {
    issues.push({
      code: "long_paragraphs",
      severity: "Low",
      message: `Average paragraph ~${avgPara.toFixed(0)} words`,
    });
    recommendations.push(rec("read_para", "Low", "readability", "Break up dense paragraphs", "body"));
  }
  let score = 85;
  if (avgSentence > 28) score -= 15;
  if (avgPara > 120) score -= 10;
  return {
    validator_id: "readability",
    score: Math.max(0, score),
    passed: true,
    issues,
    recommendations,
    metrics: {
      avg_sentence_length: Math.round(avgSentence * 10) / 10,
      avg_paragraph_length: Math.round(avgPara * 10) / 10,
    },
  };
}

/** Thin SEO heuristics (title / meta / keyword presence). */
export function runSeoThinValidator(draft: DraftForOptimize, topic?: string): ValidatorResult {
  const issues: ValidatorResult["issues"] = [];
  const recommendations: OptimizationRecommendation[] = [];
  const meta = draft.meta_description ?? draft.excerpt ?? "";
  if (meta.length < 50 || meta.length > 160) {
    issues.push({
      code: "meta_length",
      severity: "High",
      message: `Meta/excerpt length ${meta.length} outside 50–160`,
    });
    recommendations.push(rec("seo_meta", "High", "seo", "Write a 50–160 character meta description", "meta"));
  }
  if (topic) {
    const needle = topic.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
    if (needle && !draft.title.toLowerCase().includes(needle.split(" ")[0]!)) {
      issues.push({
        code: "topic_in_title",
        severity: "Medium",
        message: "Primary topic token missing from title",
      });
      recommendations.push(rec("seo_title_kw", "Medium", "seo", "Include primary topic in title", "title"));
    }
  }
  const score = Math.max(40, 90 - issues.length * 12);
  return {
    validator_id: "seo_thin",
    score,
    passed: !issues.some((i) => i.severity === "Critical"),
    issues,
    recommendations,
  };
}

/** Thin UX heuristics — must not solely fail the quality gate (ADR-008). */
export function runUxThinValidator(draft: DraftForOptimize, opts?: { softPersonal?: boolean }): ValidatorResult {
  const text = stripTags(draft.content);
  const first = text.slice(0, 280).toLowerCase();
  const hasHook = first.length > 40;
  const hasCta = /\b(try this|try it|learn more|subscribe|contact us|get started|read more|sign up|book a)\b/i.test(
    text
  );
  const recommendations: OptimizationRecommendation[] = [];
  // Personal/linkedin: do not push CTA / takeaway recommendations.
  if (!opts?.softPersonal && !hasCta) {
    recommendations.push(rec("ux_cta", "Low", "ux", "Consider a clear call-to-action near the end", "body"));
  }
  const hook = hasHook ? 75 : 50;
  const cta = opts?.softPersonal ? 80 : hasCta ? 80 : 55;
  const aggregate = Math.round((hook + cta) / 2);
  return {
    validator_id: "ux_thin",
    score: aggregate,
    passed: true,
    issues: [],
    recommendations,
    metrics: { hook_quality: hook, cta_effectiveness: cta },
    rationale: opts?.softPersonal
      ? "MVP thin UX — personal format; CTA advisory suppressed"
      : "MVP thin UX — advisory only for gate",
  };
}

export function assembleOptimizationPlan(
  validators: ValidatorResult[],
  opts?: { softPersonal?: boolean }
): OptimizationPlan {
  const all = validators.flatMap((v) => v.recommendations);
  const critical = all.filter((r) => r.priority === "Critical");
  const high = all.filter((r) => r.priority === "High");
  const medium = all.filter((r) => r.priority === "Medium");
  const low = all.filter((r) => r.priority === "Low");
  const writing_brief = opts?.softPersonal
    ? [
        critical.length ? `Fix critical: ${critical.map((r) => r.message).join("; ")}` : null,
        high.length ? `Address high: ${high.map((r) => r.message).join("; ")}` : null,
        "Preserve the user's voice and concrete scenes. Do not add CTAs, forced takeaways, or invented lessons.",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        critical.length ? `Fix critical: ${critical.map((r) => r.message).join("; ")}` : null,
        high.length ? `Address high: ${high.map((r) => r.message).join("; ")}` : null,
        "Preserve grounded claims from the Research Package; do not invent citations.",
      ]
        .filter(Boolean)
        .join(" ");
  return { version: 1, critical, high, medium, low, writing_brief };
}

export function buildThinOptimizationReport(input: {
  draft: DraftForOptimize;
  draft_id?: string;
  research_package_id?: string;
  topic?: string;
  factual_confidence?: number;
  /** Soften CTA/takeaway pressure for personal_story / linkedin_post. */
  post_format?: string;
}): ContentOptimizationReport {
  const softPersonal = input.post_format === "personal_story" || input.post_format === "linkedin_post";
  const structural = runStructuralValidator(input.draft);
  const readability = runReadabilityValidator(input.draft);
  const seo = runSeoThinValidator(input.draft, input.topic);
  const ux = runUxThinValidator(input.draft, { softPersonal });
  const validators = [structural, readability, seo, ux];
  const plan = assembleOptimizationPlan(validators, { softPersonal });

  const seoScore = seo.score ?? 70;
  const readabilityScore = readability.score ?? 70;
  const uxScore = ux.score ?? 70;
  const authority = 70;
  const gao = Math.round((seoScore + readabilityScore) / 2);
  const factual = input.factual_confidence ?? 70;
  const overall = computeOverallScore({
    seo: seoScore,
    gao,
    authority,
    readability: readabilityScore,
    ux: uxScore,
    factual_confidence: factual,
  });
  const quality_gate_passed = evaluateQualityGate(overall, plan.critical.length);

  const readMetrics = readability.metrics ?? {};
  const report = {
    version: 1 as const,
    id: `opt_${randomUUID()}`,
    draft_id: input.draft_id,
    research_package_id: input.research_package_id,
    created_at: new Date().toISOString(),
    seo: {
      version: 1 as const,
      metrics: [
        {
          name: "seo_thin",
          score: seoScore,
          explanation: "Thin SEO heuristics",
          issues: seo.issues.map((i) => i.message),
          recommendations: seo.recommendations.map((r) => r.message),
        },
      ],
      aggregate: seoScore,
    },
    gao: {
      version: 1 as const,
      metrics: [
        {
          name: "gao_proxy",
          score: gao,
          explanation: "MVP proxy from SEO + readability",
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
      avg_sentence_length: Number(readMetrics.avg_sentence_length ?? 0),
      avg_paragraph_length: Number(readMetrics.avg_paragraph_length ?? 0),
      aggregate: readabilityScore,
      recommendations: readability.recommendations,
    },
    ux: {
      hook_quality: Number(ux.metrics?.hook_quality ?? 70),
      pacing: 70,
      section_flow: 70,
      cta_effectiveness: Number(ux.metrics?.cta_effectiveness ?? 55),
      visual_opportunities: [],
      aggregate: uxScore,
      recommendations: ux.recommendations,
    },
    validator_results: validators,
    plan,
    quality: {
      seo: seoScore,
      gao,
      authority,
      readability: readabilityScore,
      ux: uxScore,
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
    quality_gate_passed,
    metadata_suggestions: {
      title: input.draft.title,
      meta_description: input.draft.meta_description ?? input.draft.excerpt,
    },
  };

  return contentOptimizationReportSchema.parse(report);
}

export { canOptimizeAgain, evaluateQualityGate, MVP_LOCKS };
