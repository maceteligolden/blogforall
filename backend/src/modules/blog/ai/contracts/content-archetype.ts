import { z } from "zod";

/** Animalz-aligned SEO/AEO content shapes (orthogonal to orchestrator PostFormat voice). */
export const CONTENT_ARCHETYPES = [
  "definitive_guide",
  "how_to",
  "listicle",
  "software_roundup",
  "comparison",
  "case_study",
  "thought_leadership",
  "article",
] as const;

export const contentArchetypeSchema = z.enum(CONTENT_ARCHETYPES);
export type ContentArchetype = z.infer<typeof contentArchetypeSchema>;

export const RESEARCH_NEEDS = [
  "steps_ui_paths",
  "prerequisites_myths",
  "option_inventory",
  "evaluation_criteria",
  "pricing_features",
  "metrics_outcomes",
  "counterarguments",
  "subtopic_coverage",
  "lived_user_words",
] as const;

export type ResearchNeed = (typeof RESEARCH_NEEDS)[number];

export type ArchetypeStructureRules = {
  word_count_floor: number;
  outline_guidance: string;
  h2_shape: string;
  forbidden_h2_patterns: RegExp[];
  default_research_needs: ResearchNeed[];
  require_early_verdict_table?: boolean;
  require_item_count_match?: boolean;
  mece_sections?: boolean;
};

const GLOBAL_AI_TELLS = [
  "leverage",
  "utilize",
  "robust",
  "seamless",
  "delve",
  "landscape",
  "ecosystem",
  "cutting-edge",
  "innovative",
  "in today's world",
  "it is important to",
];

export function globalBannedRegister(): string[] {
  return [...GLOBAL_AI_TELLS];
}

/** Map interactive / UI labels onto ContentArchetype. */
export function coerceContentArchetype(value?: string | null): ContentArchetype | undefined {
  if (!value?.trim()) return undefined;
  const v = value.trim().toLowerCase().replace(/-/g, "_");
  if ((CONTENT_ARCHETYPES as readonly string[]).includes(v)) return v as ContentArchetype;
  switch (v) {
    case "tutorial":
      return "how_to";
    case "guide":
    case "deep_dive":
      return "definitive_guide";
    case "opinion":
    case "pov":
      return "thought_leadership";
    case "roundup":
    case "software_roundup":
      return "software_roundup";
    case "case_study":
    case "casestudy":
      return "case_study";
    case "interview":
      return "article";
    default:
      return undefined;
  }
}

export function isContentArchetype(value: unknown): value is ContentArchetype {
  return typeof value === "string" && (CONTENT_ARCHETYPES as readonly string[]).includes(value);
}

export function structureRulesForArchetype(archetype: ContentArchetype): ArchetypeStructureRules {
  switch (archetype) {
    case "how_to":
      return {
        word_count_floor: 800,
        outline_guidance:
          "H2s are sequential action steps written as imperatives (e.g. 'Set Up Your Chart of Accounts'). No 'What Is' section.",
        h2_shape: "imperative_steps",
        forbidden_h2_patterns: [/^what\s+is\b/i, /^understanding\b/i],
        default_research_needs: ["steps_ui_paths", "prerequisites_myths"],
      };
    case "listicle":
      return {
        word_count_floor: 900,
        outline_guidance:
          "Only H2s are the list items promised in the title. Parallel depth. Optional short conclusion H2 only.",
        h2_shape: "list_items",
        forbidden_h2_patterns: [/^why\s+it'?s\s+important\b/i, /^what\s+is\b/i],
        default_research_needs: ["option_inventory"],
        require_item_count_match: true,
      };
    case "software_roundup":
      return {
        word_count_floor: 1200,
        outline_guidance:
          "H2s are tool names. Each section: features, pricing, pros/cons, best for. State evaluation criteria in the intro; comparison table near top.",
        h2_shape: "tool_names",
        forbidden_h2_patterns: [/^what\s+is\b/i],
        default_research_needs: ["evaluation_criteria", "pricing_features", "option_inventory"],
        require_early_verdict_table: true,
      };
    case "comparison":
      return {
        word_count_floor: 1100,
        outline_guidance:
          "H2s are decision criteria (pricing, ease of use, integrations) — not product names. Compare options side by side. Early summary table + recommendation.",
        h2_shape: "criteria",
        forbidden_h2_patterns: [],
        default_research_needs: ["evaluation_criteria", "pricing_features", "counterarguments"],
        require_early_verdict_table: true,
      };
    case "case_study":
      return {
        word_count_floor: 1000,
        outline_guidance:
          "Narrative arc with specific headers stating problem, approach, and outcome — not generic 'The Challenge'. Customer is the hero. Include real metrics when available.",
        h2_shape: "problem_solution_outcome",
        forbidden_h2_patterns: [/^the\s+challenge$/i, /^the\s+solution$/i, /^overview$/i],
        default_research_needs: ["metrics_outcomes", "lived_user_words"],
      };
    case "definitive_guide":
      return {
        word_count_floor: 3000,
        outline_guidance:
          "MECE major subtopics as H2s. Each section nearly standalone. No vague -ing headers. Only call it definitive/complete if coverage is exhaustive.",
        h2_shape: "mece_subtopics",
        forbidden_h2_patterns: [/^understanding\b/i],
        default_research_needs: ["subtopic_coverage", "counterarguments"],
        mece_sections: true,
      };
    case "thought_leadership":
      return {
        word_count_floor: 900,
        outline_guidance:
          "Lead with thesis. Each H2 advances the argument. Evidence + acknowledge counterarguments. No bolted-on how-to list.",
        h2_shape: "argument_steps",
        forbidden_h2_patterns: [/^what\s+is\b/i, /^how\s+to\b/i],
        default_research_needs: ["counterarguments"],
      };
    case "article":
    default:
      return {
        word_count_floor: 800,
        outline_guidance: "Clear sections matched to reader intent; prefer a more specific archetype when possible.",
        h2_shape: "general",
        forbidden_h2_patterns: [],
        default_research_needs: ["subtopic_coverage"],
      };
  }
}

/** Intent → archetype (Animalz quick reference). */
export function archetypeFromReaderIntent(intent: string): ContentArchetype {
  const t = intent.toLowerCase();
  if (/understand everything|exhaustive|pillar|definitive|complete guide/.test(t)) return "definitive_guide";
  if (/how do i|how to|step[- ]by[- ]step|tutorial/.test(t)) return "how_to";
  if (/what options|list of|best \d+|tips for/.test(t)) return "listicle";
  if (/what should i (buy|use)|roundup|best tools|software for/.test(t)) return "software_roundup";
  if (/\bvs\b|versus|compared to|which (one|tool)|decide between/.test(t)) return "comparison";
  if (/case study|in practice|results we|customer story/.test(t)) return "case_study";
  if (/what should i think|opinion|pov|argue|contrarian|thesis/.test(t)) return "thought_leadership";
  return "article";
}

export function defaultWordCountForArchetype(
  archetype: ContentArchetype,
  preset?: "short" | "medium" | "long" | "pillar"
): number {
  if (preset === "short") return 800;
  if (preset === "medium") return 1500;
  if (preset === "long") return 2500;
  if (preset === "pillar") return 3500;
  const floor = structureRulesForArchetype(archetype).word_count_floor;
  if (archetype === "definitive_guide") return Math.max(floor, 3500);
  return Math.max(floor, 1500);
}

export function outlinePromptForArchetype(archetype: ContentArchetype, itemCount?: number): string {
  const rules = structureRulesForArchetype(archetype);
  const countLine =
    archetype === "listicle" && itemCount
      ? `Produce exactly ${itemCount} item sections (H2s = the items). Title number must match.`
      : "";
  return `${rules.outline_guidance}
H2 shape: ${rules.h2_shape}.
${countLine}
Forbidden H2 patterns: ${rules.forbidden_h2_patterns.map((r) => r.source).join(", ") || "(none)"}.
Word-count floor for this archetype: ~${rules.word_count_floor}+ words.`;
}
