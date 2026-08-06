import {
  coerceContentArchetype,
  globalBannedRegister,
  structureRulesForArchetype,
  type ContentArchetype,
} from "./contracts/content-archetype";
import type { StyleProfile } from "./contracts/style-profile";
import type {
  OptimizationRecommendation,
  ValidatorResult,
} from "../../orchestrator/ai/contracts/content-optimization";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function h2Texts(html: string): string[] {
  const out: string[] = [];
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(stripTags(m[1] || ""));
  }
  return out;
}

function sectionWordCounts(html: string): number[] {
  const parts = html.split(/<h2\b/i);
  return parts.slice(1).map((p) => stripTags(p).split(/\s+/).filter(Boolean).length);
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

export type ArchetypeValidateInput = {
  title: string;
  content: string;
  archetype?: ContentArchetype | string;
  style_profile?: StyleProfile;
  /** True when enrichment/chat provided metrics */
  had_metrics?: boolean;
};

/**
 * Animalz structure + prose quality gates for content archetypes.
 */
export function runArchetypeQualityValidator(input: ArchetypeValidateInput): ValidatorResult {
  const archetype =
    coerceContentArchetype(input.archetype) || input.style_profile?.archetype || undefined;
  const issues: ValidatorResult["issues"] = [];
  const recommendations: OptimizationRecommendation[] = [];
  if (!archetype) {
    return {
      validator_id: "archetype_quality",
      score: 80,
      passed: true,
      issues,
      recommendations,
    };
  }

  const rules = structureRulesForArchetype(archetype);
  const text = stripTags(input.content);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const headings = h2Texts(input.content);
  const banned = input.style_profile?.lexicon.banned_register ?? globalBannedRegister();

  for (const h of headings) {
    for (const pat of rules.forbidden_h2_patterns) {
      if (pat.test(h)) {
        issues.push({
          code: "forbidden_h2",
          severity: "High",
          message: `H2 "${h}" violates ${archetype} rules (${pat})`,
        });
        recommendations.push(
          rec(
            "arch_forbidden_h2",
            "High",
            "structure",
            `Rewrite or remove H2 "${h}" — not allowed for ${archetype}`,
            "structure"
          )
        );
      }
    }
  }

  if (archetype === "definitive_guide" && wordCount < 2500) {
    const claimsDefinitive = /\b(definitive|ultimate|complete)\b/i.test(input.title);
    issues.push({
      code: "definitive_thin",
      severity: claimsDefinitive ? "High" : "Medium",
      message: `Definitive guide has only ${wordCount} words (expect ~3000+)`,
    });
    recommendations.push(
      rec(
        "arch_def_len",
        claimsDefinitive ? "High" : "Medium",
        "structure",
        claimsDefinitive
          ? "Expand coverage or remove definitive/ultimate/complete from the title"
          : "Expand toward pillar length (~3000+ words)",
        "body"
      )
    );
  }

  if (rules.require_item_count_match) {
    const m = input.title.match(/\b(\d+)\b/);
    if (m) {
      const n = parseInt(m[1]!, 10);
      const itemHeadings = headings.filter((h) => !/^conclusion|wrap[- ]?up|final/i.test(h));
      if (n > 0 && itemHeadings.length !== n) {
        issues.push({
          code: "listicle_count_mismatch",
          severity: "High",
          message: `Title promises ${n} items but found ${itemHeadings.length} item H2s`,
        });
        recommendations.push(
          rec("arch_list_count", "High", "structure", `Match title count (${n}) to item H2 count`, "structure")
        );
      }
    }
    const lengths = sectionWordCounts(input.content);
    if (lengths.length >= 3) {
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const uneven = lengths.some((w) => Math.abs(w - avg) / avg > 0.35);
      if (uneven) {
        issues.push({
          code: "listicle_uneven",
          severity: "Medium",
          message: "Listicle sections vary widely in depth",
        });
        recommendations.push(
          rec("arch_list_parallel", "Medium", "structure", "Keep listicle items roughly parallel in depth (±30%)", "body")
        );
      }
    }
  }

  if (rules.require_early_verdict_table) {
    const early = input.content.slice(0, Math.min(input.content.length, 2500));
    if (!/<table\b/i.test(early)) {
      issues.push({
        code: "missing_early_table",
        severity: "High",
        message: "Comparison/roundup missing an early HTML comparison table",
      });
      recommendations.push(
        rec(
          "arch_table",
          "High",
          "structure",
          "Add a summary comparison table near the top with a clear recommendation",
          "structure"
        )
      );
    }
  }

  if (archetype === "case_study") {
    const hasDigits = /\d/.test(text);
    if (!hasDigits && !input.had_metrics) {
      issues.push({
        code: "case_study_no_metrics",
        severity: "Medium",
        message: "Case study lacks outcome metrics language",
      });
      recommendations.push(
        rec(
          "arch_case_metrics",
          "Medium",
          "structure",
          "Add real outcome metrics if available; otherwise use qualitative outcomes without inventing numbers",
          "body"
        )
      );
    }
    if (!input.had_metrics && /\b(increased|decreased|dropped|rose)\s+by\s+\d+/i.test(text)) {
      issues.push({
        code: "possible_invented_metrics",
        severity: "High",
        message: "Numeric outcomes present but no user-supplied metrics — risk of invention",
      });
      recommendations.push(
        rec("arch_invented_metrics", "High", "factual", "Remove or source invented-looking metrics", "body")
      );
    }
  }

  const lower = text.toLowerCase();
  let banHits = 0;
  for (const phrase of banned) {
    if (phrase.length < 3) continue;
    if (lower.includes(phrase.toLowerCase())) banHits += 1;
  }
  if (banHits >= 3) {
    issues.push({
      code: "ai_tell_density",
      severity: "High",
      message: `High density of banned/AI-tell phrases (${banHits} hits)`,
    });
    recommendations.push(
      rec("arch_ai_tells", "High", "style", "Rewrite to remove banned register and stock AI phrasing", "body")
    );
  } else if (banHits >= 1) {
    recommendations.push(rec("arch_ai_tells_soft", "Low", "style", "Trim remaining banned/AI-tell phrases", "body"));
  }

  if (input.style_profile?.craft.sentence_rhythm === "short_punchy") {
    const sents = text.split(/[.!?]+/).filter((s) => s.trim());
    const avg = sents.length ? sents.reduce((a, s) => a + s.trim().split(/\s+/).length, 0) / sents.length : 0;
    if (avg > 24) {
      issues.push({
        code: "rhythm_mismatch",
        severity: "Medium",
        message: `Variant expects short punchy sentences; avg ~${avg.toFixed(1)} words`,
      });
      recommendations.push(rec("arch_rhythm", "Medium", "readability", "Shorten sentences to match style variant", "body"));
    }
  }

  if (input.style_profile?.variant === "war_story_howto" && !/\b(i|we|my|our)\b/i.test(text.slice(0, 800))) {
    issues.push({
      code: "variant_compliance",
      severity: "Medium",
      message: "war_story_howto variant missing first-person beats near the open",
    });
    recommendations.push(
      rec("arch_war_story", "Medium", "style", "Open with a lived first-person beat from the author's notes", "body")
    );
  }

  const score = Math.max(
    0,
    100 -
      issues.reduce(
        (a: number, i: { severity: string }) =>
          a + (i.severity === "Critical" ? 30 : i.severity === "High" ? 15 : 8),
        0
      )
  );
  return {
    validator_id: "archetype_quality",
    score,
    passed: !issues.some((i: { severity: string }) => i.severity === "Critical"),
    issues,
    recommendations,
    metrics: { word_count: wordCount, h2_count: headings.length, ban_hits: banHits },
  };
}
