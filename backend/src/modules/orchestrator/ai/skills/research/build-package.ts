import { randomUUID } from "crypto";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import {
  assertResearchProvenance,
  researchPackageSchema,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../../contracts/research-package";
import type { ResearchBrief } from "../../../../blog/ai/contracts/research-brief";
import { researchTopicFromBrief } from "../../../../blog/ai/contracts/research-brief";

export type ResearchNoteLike = {
  url: string;
  title: string;
  snippet?: string;
  claim?: string;
  question_id?: string;
  source_kind?: "web" | "extract" | "user" | "first_party";
  /** Optional bucket hint from LLM synthesis. */
  kind?: "fact" | "definition" | "statistic" | "example";
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
  /** Clarified research brief — drives questions + coverage. */
  research_brief?: ResearchBrief;
};

export type BuiltResearchPackage = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
};

/** Shared Research Package assembly for lite/full depths. */
export function buildResearchPackageFromNotes(input: BuildResearchPackageInput): BuiltResearchPackage {
  const brief = input.research_brief;
  const topic = (brief ? researchTopicFromBrief(brief) : input.topic).trim();
  const capped = input.notes.slice(0, input.max_sources);
  const now = new Date().toISOString();
  const narrativeMode = input.post_format === "personal_story" || input.post_format === "linkedin_post";

  const questions =
    brief?.must_answer?.length && !narrativeMode
      ? brief.must_answer.map((question: string, i: number) => ({
          id: `q${i + 1}`,
          question,
          priority: i + 1,
        }))
      : narrativeMode
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
    url: n.url && /^https?:\/\//i.test(n.url) ? n.url : `https://local.invalid/research/note/${i + 1}`,
    title: n.title || `Source ${i + 1}`,
    snippet: n.snippet,
    category: "other" as const,
    quality_score: n.source_kind === "extract" || n.source_kind === "user" ? 0.75 : input.depth === "full" ? 0.65 : 0.6,
    freshness: "recent" as const,
    retrieved_at: now,
  }));

  const provenanced = sources.map((s, i) => {
    const note = capped[i]!;
    const qid =
      note.question_id && questions.some((q) => q.id === note.question_id)
        ? note.question_id
        : questions[Math.min(i % questions.length, questions.length - 1)]!.id;
    const kind =
      note.kind === "definition" || note.kind === "statistic" || note.kind === "example"
        ? note.kind
        : ("fact" as const);
    return {
      id: `f${i + 1}`,
      kind,
      text: (note.claim || s.snippet || s.title).slice(0, 280),
      source_id: s.id,
      confidence: note.source_kind === "user" ? 0.85 : input.depth === "full" ? 0.6 : 0.55,
      freshness: "recent" as const,
      research_question_ids: [qid],
    };
  });
  const facts = provenanced.filter((f) => f.kind === "fact");
  const definitionsFromNotes = provenanced.filter((f) => f.kind === "definition");
  const statisticsFromNotes = provenanced.filter((f) => f.kind === "statistic");

  const coverageItems = questions.map((q) => {
    const hit = provenanced.filter((f) => f.research_question_ids.includes(q.id)).length;
    const status = hit === 0 ? ("missing" as const) : hit >= 2 ? ("completed" as const) : ("partial" as const);
    return { research_question_id: q.id, status };
  });
  const completed = coverageItems.filter((c) => c.status === "completed").length;
  const partial = coverageItems.filter((c) => c.status === "partial").length;
  const coverage_score = questions.length === 0 ? 0.2 : Math.min(0.95, (completed + partial * 0.5) / questions.length);

  const degraded = sources.length === 0;
  const effectiveCoverage = degraded ? 0.2 : coverage_score;

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
      : effectiveCoverage < MVP_LOCKS.coverageMin
        ? [{ id: "g1", description: "Coverage below MVP minimum", priority: 1 }]
        : brief?.ambiguity.is_ambiguous
          ? [{ id: "g_ambiguous", description: "Topic scope was ambiguous at search time", priority: 1 }]
          : [],
    definitions: definitionsFromNotes.map((f, i) => ({ ...f, id: `d${i + 1}`, kind: "definition" as const })),
    facts: facts.map((f, i) => ({ ...f, id: `f${i + 1}`, kind: "fact" as const })),
    statistics: statisticsFromNotes.map((f, i) => ({ ...f, id: `st${i + 1}`, kind: "statistic" as const })),
    examples: [],
    expert_opinions: [],
    recent_developments: [],
    entities:
      brief?.scope.kind === "named_entity"
        ? [
            {
              id: "e1",
              name: brief.scope.entity,
              type: "person" as const,
              aliases: brief.scope.disambiguators,
              source_ids: sources.slice(0, 1).map((s) => s.id),
            },
          ]
        : [],
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
      coverage_score: effectiveCoverage,
      completed_areas: coverageItems.filter((c) => c.status === "completed").map((c) => c.research_question_id),
      partial_areas: coverageItems.filter((c) => c.status === "partial").map((c) => c.research_question_id),
      missing_areas: coverageItems.filter((c) => c.status === "missing").map((c) => c.research_question_id),
    },
    confidence_summary: {
      mean_source_quality: sources.length ? sources.reduce((a, s) => a + s.quality_score, 0) / sources.length : 0,
      mean_fact_confidence: provenanced.length
        ? provenanced.reduce((a, f) => a + f.confidence, 0) / provenanced.length
        : 0,
      contradiction_count: 0,
    },
    degraded: degraded || undefined,
    disclosure: degraded
      ? narrativeMode
        ? `No web research for ${input.post_format}; Writing must use only the user's lived words — do not invent meaning or citations.`
        : `Research ${input.depth} returned no web sources; Writing must not invent citations.`
      : brief?.first_party_reuse.avoid_duplicate_angles.length
        ? `Avoid repeating angles: ${brief.first_party_reuse.avoid_duplicate_angles.slice(0, 3).join("; ")}`
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
