import { z } from "zod";

export const freshnessSchema = z.enum(["evergreen", "recent", "breaking", "historical", "deprecated"]);

export const sourceCategorySchema = z.enum([
  "official_docs",
  "engineering_blog",
  "github",
  "rfc",
  "paper",
  "industry_report",
  "survey",
  "company_blog",
  "whitepaper",
  "case_study",
  "government",
  "university",
  "medical_journal",
  "news",
  "other",
]);

export const researchSourceSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  snippet: z.string().optional(),
  category: sourceCategorySchema,
  quality_score: z.number().min(0).max(1),
  quality_rationale: z.string().optional(),
  freshness: freshnessSchema.optional(),
  retrieved_at: z.string().min(1),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export const provenancedFactSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["definition", "fact", "statistic", "example", "quotation", "implementation", "limitation", "opinion"]),
  text: z.string().min(1),
  value: z.string().optional(),
  date: z.string().optional(),
  source_id: z.string().min(1),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
  research_question_ids: z.array(z.string()).optional(),
});

export const researchEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["person", "product", "company", "technology", "concept", "standard", "other"]),
  aliases: z.array(z.string()).optional(),
  source_ids: z.array(z.string()).optional(),
});

export const researchRelationshipSchema = z.object({
  id: z.string().min(1),
  from_entity_id: z.string().min(1),
  predicate: z.string().min(1),
  to_entity_id: z.string().min(1),
  evidence_ids: z.array(z.string()).optional(),
});

export const researchContradictionSchema = z.object({
  id: z.string().min(1),
  claim_a: z.string().min(1),
  claim_b: z.string().min(1),
  evidence_a_ids: z.array(z.string()).min(1),
  evidence_b_ids: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
});

export const competitorInsightsSchema = z.object({
  articles: z.array(
    z.object({
      url: z.string().url(),
      title: z.string().min(1),
      headings: z.array(z.string()),
      approx_word_count: z.number().optional(),
      topics: z.array(z.string()),
      strengths: z.array(z.string()).optional(),
      weaknesses: z.array(z.string()).optional(),
    })
  ),
  common_headings: z.array(z.string()),
  common_topics: z.array(z.string()),
  average_length: z.number().optional(),
  differentiation_opportunities: z.array(z.string()),
  missing_in_competitors: z.array(z.string()),
});

export const evidenceNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["claim", "evidence", "source", "entity"]),
  label: z.string().min(1),
  ref_id: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const evidenceEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["supports", "contradicts", "related_to", "mentions", "attributed_to"]),
});

export const evidenceGraphSchema = z.object({
  nodes: z.array(evidenceNodeSchema),
  edges: z.array(evidenceEdgeSchema),
});

export const coverageItemSchema = z.object({
  research_question_id: z.string().min(1),
  status: z.enum(["completed", "partial", "missing"]),
  notes: z.string().optional(),
});

export const coverageReportSchema = z.object({
  items: z.array(coverageItemSchema),
  coverage_score: z.number().min(0).max(1),
  completed_areas: z.array(z.string()),
  partial_areas: z.array(z.string()),
  missing_areas: z.array(z.string()),
});

export const researchPackageSchema = z.object({
  version: z.literal(2),
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  created_at: z.string().min(1),
  depth: z.enum(["lite", "full"]),
  topic: z.string().min(1),
  audience: z.string().min(1),
  search_intent: z.string().min(1),
  freshness_requirement: z.string().optional(),
  research_questions: z.array(
    z.object({
      id: z.string().min(1),
      question: z.string().min(1),
      priority: z.number(),
    })
  ),
  knowledge_gaps: z.array(
    z.object({
      id: z.string().min(1),
      description: z.string().min(1),
      priority: z.number(),
    })
  ),
  definitions: z.array(provenancedFactSchema),
  facts: z.array(provenancedFactSchema),
  statistics: z.array(provenancedFactSchema),
  examples: z.array(provenancedFactSchema),
  expert_opinions: z.array(provenancedFactSchema),
  recent_developments: z.array(provenancedFactSchema),
  entities: z.array(researchEntitySchema),
  relationships: z.array(researchRelationshipSchema),
  contradictions: z.array(researchContradictionSchema),
  competitor_insights: competitorInsightsSchema.optional(),
  evidence_graph: evidenceGraphSchema,
  sources: z.array(researchSourceSchema),
  references: z.array(
    z.object({
      source_id: z.string().min(1),
      url: z.string().url(),
      title: z.string().min(1),
    })
  ),
  coverage: coverageReportSchema,
  confidence_summary: z.object({
    mean_source_quality: z.number().min(0).max(1),
    mean_fact_confidence: z.number().min(0).max(1),
    contradiction_count: z.number().int().nonnegative(),
  }),
  degraded: z.boolean().optional(),
  disclosure: z.string().optional(),
  strategy_id: z.string().optional(),
  brief: z.unknown().optional(),
  searches: z.unknown().optional(),
  documents: z.unknown().optional(),
  claims: z.unknown().optional(),
  findings: z.unknown().optional(),
  critic_notes: z.unknown().optional(),
  report_markdown: z.string().optional(),
  spoken_summary: z.string().optional(),
});

export const researchPackageSummarySchema = z.object({
  topic: z.string().min(1),
  depth: z.enum(["lite", "full"]),
  coverage_score: z.number().min(0).max(1),
  source_count: z.number().int().nonnegative(),
  contradiction_count: z.number().int().nonnegative(),
  degraded: z.boolean().optional(),
});

export type ResearchPackage = z.infer<typeof researchPackageSchema>;
export type ResearchPackageSummary = z.infer<typeof researchPackageSummarySchema>;
export type ProvenancedFact = z.infer<typeof provenancedFactSchema>;

/** Every provenanced unit must reference a source present on the package. */
export function assertResearchProvenance(pkg: ResearchPackage): string[] {
  const sourceIds = new Set(pkg.sources.map((s) => s.id));
  const facts = [
    ...pkg.definitions,
    ...pkg.facts,
    ...pkg.statistics,
    ...pkg.examples,
    ...pkg.expert_opinions,
    ...pkg.recent_developments,
  ];
  const errors: string[] = [];
  for (const fact of facts) {
    if (!sourceIds.has(fact.source_id)) {
      errors.push(`Fact ${fact.id} references missing source_id ${fact.source_id}`);
    }
  }
  return errors;
}

export function needsCoverageRetry(
  depth: "lite" | "full",
  coverageScore: number,
  coverageRetries: number,
  coverageMin: number,
  retryMax: number
): boolean {
  if (depth === "lite") return false;
  return coverageScore < coverageMin && coverageRetries < retryMax;
}
