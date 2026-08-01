import { randomUUID } from "crypto";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import {
  assertResearchProvenance,
  researchPackageSchema,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../../contracts/research-package";

export type ResearchNoteLike = {
  url: string;
  title: string;
  snippet?: string;
};

export type BuildResearchPackageInput = {
  workspace_id: string;
  topic: string;
  depth: "lite" | "full";
  audience?: string;
  search_intent?: string;
  notes: ResearchNoteLike[];
  max_sources: number;
  /** When personal/linkedin, avoid how-to / best-practices research questions. */
  post_format?: string;
};

export type BuiltResearchPackage = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
};

/** Shared Research Package assembly for lite/full depths. */
export function buildResearchPackageFromNotes(
  input: BuildResearchPackageInput,
): BuiltResearchPackage {
  const topic = input.topic.trim();
  const capped = input.notes.slice(0, input.max_sources);
  const now = new Date().toISOString();
  const narrativeMode =
    input.post_format === "personal_story" || input.post_format === "linkedin_post";
  const questions = narrativeMode
    ? [
        {
          id: "q1",
          question: `What concrete details did the user share about ${topic}?`,
          priority: 1,
        },
      ]
    : input.depth === "full"
      ? [
          { id: "q1", question: `What should a reader know about ${topic}?`, priority: 1 },
          { id: "q2", question: `What are current best practices for ${topic}?`, priority: 2 },
          { id: "q3", question: `What pitfalls or limitations exist around ${topic}?`, priority: 3 },
        ]
      : [{ id: "q1", question: `What should a reader know about ${topic}?`, priority: 1 }];

  const sources = capped.map((n, i) => ({
    id: `s${i + 1}`,
    url: n.url,
    title: n.title || `Source ${i + 1}`,
    snippet: n.snippet,
    category: "other" as const,
    quality_score: input.depth === "full" ? 0.65 : 0.6,
    freshness: "recent" as const,
    retrieved_at: now,
  }));

  const facts = sources.map((s, i) => ({
    id: `f${i + 1}`,
    kind: "fact" as const,
    text: (s.snippet || s.title).slice(0, 500),
    source_id: s.id,
    confidence: input.depth === "full" ? 0.6 : 0.55,
    freshness: "recent" as const,
    research_question_ids: [questions[Math.min(i % questions.length, questions.length - 1)]!.id],
  }));

  const degraded = sources.length === 0;
  const perSource = input.depth === "full" ? 0.06 : 0.08;
  const base = input.depth === "full" ? 0.4 : 0.35;
  const coverage_score = degraded
    ? 0.2
    : Math.min(input.depth === "full" ? 0.85 : 0.75, base + sources.length * perSource);

  const coverageItems = questions.map((q) => ({
    research_question_id: q.id,
    status: (degraded ? "missing" : coverage_score >= MVP_LOCKS.coverageMin ? "completed" : "partial") as
      | "missing"
      | "partial"
      | "completed",
  }));

  const pkg = researchPackageSchema.parse({
    version: 2,
    id: `rp_${randomUUID()}`,
    workspace_id: input.workspace_id,
    created_at: now,
    depth: input.depth,
    topic,
    audience: input.audience ?? "general",
    search_intent: input.search_intent ?? "informational",
    research_questions: questions,
    knowledge_gaps: degraded
      ? [{ id: "g1", description: "No live sources retrieved", priority: 1 }]
      : coverage_score < MVP_LOCKS.coverageMin
        ? [{ id: "g1", description: "Coverage below MVP minimum", priority: 1 }]
        : [],
    definitions: [],
    facts,
    statistics: [],
    examples: [],
    expert_opinions: [],
    recent_developments: [],
    entities: [],
    relationships: [],
    contradictions: [],
    evidence_graph: {
      nodes: sources.map((s) => ({
        id: `n_${s.id}`,
        type: "source" as const,
        label: s.title,
        ref_id: s.id,
      })),
      edges: [],
    },
    sources,
    references: sources.map((s) => ({
      source_id: s.id,
      url: s.url,
      title: s.title,
    })),
    coverage: {
      items: coverageItems,
      coverage_score,
      completed_areas: coverage_score >= MVP_LOCKS.coverageMin ? ["overview"] : [],
      partial_areas: !degraded && coverage_score < MVP_LOCKS.coverageMin ? ["overview"] : [],
      missing_areas: degraded ? ["overview"] : [],
    },
    confidence_summary: {
      mean_source_quality: sources.length
        ? sources.reduce((a, s) => a + s.quality_score, 0) / sources.length
        : 0,
      mean_fact_confidence: facts.length
        ? facts.reduce((a, f) => a + f.confidence, 0) / facts.length
        : 0,
      contradiction_count: 0,
    },
    degraded: degraded || undefined,
    disclosure: degraded
      ? narrativeMode
        ? `No web research for ${input.post_format}; Writing must use only the user's lived words — do not invent meaning or citations.`
        : `Research ${input.depth} returned no web sources; Writing must not invent citations.`
      : undefined,
  });

  const provenance_errors = assertResearchProvenance(pkg);
  const summary: ResearchPackageSummary = {
    topic: pkg.topic,
    depth: pkg.depth,
    coverage_score: pkg.coverage.coverage_score,
    source_count: pkg.sources.length,
    contradiction_count: pkg.contradictions.length,
    degraded: pkg.degraded,
  };

  return { package: pkg, summary, provenance_errors };
}
