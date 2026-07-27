import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import { TavilySearchService } from "../../../../blog/ai/tavily-search.service";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import {
  assertResearchProvenance,
  researchPackageSchema,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../../contracts/research-package";

export type ResearchLiteInput = {
  workspace_id: string;
  topic: string;
  audience?: string;
  search_intent?: string;
  signal?: AbortSignal;
};

export type ResearchLiteResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
};

/**
 * Research skill — lite depth (doc 16).
 * Owns web search; Writing must never call Tavily.
 */
@injectable()
export class ResearchLiteService {
  constructor(private readonly tavily: TavilySearchService) {}

  async run(input: ResearchLiteInput): Promise<ResearchLiteResult> {
    const topic = input.topic.trim();
    const notes = await this.tavily.search(topic, input.signal);
    const capped = notes.slice(0, MVP_LOCKS.researchSourcesLiteMax);
    const now = new Date().toISOString();
    const qid = "q1";

    const sources = capped.map((n, i) => ({
      id: `s${i + 1}`,
      url: n.url,
      title: n.title || `Source ${i + 1}`,
      snippet: n.snippet,
      category: "other" as const,
      quality_score: 0.6,
      freshness: "recent" as const,
      retrieved_at: now,
    }));

    const facts = sources.map((s, i) => ({
      id: `f${i + 1}`,
      kind: "fact" as const,
      text: (s.snippet || s.title).slice(0, 500),
      source_id: s.id,
      confidence: 0.55,
      freshness: "recent" as const,
      research_question_ids: [qid],
    }));

    const degraded = sources.length === 0;
    const coverage_score = degraded ? 0.2 : Math.min(0.75, 0.35 + sources.length * 0.08);

    const pkg = researchPackageSchema.parse({
      version: 2,
      id: `rp_${randomUUID()}`,
      workspace_id: input.workspace_id,
      created_at: now,
      depth: "lite",
      topic,
      audience: input.audience ?? "general",
      search_intent: input.search_intent ?? "informational",
      research_questions: [{ id: qid, question: `What should a reader know about ${topic}?`, priority: 1 }],
      knowledge_gaps: degraded
        ? [{ id: "g1", description: "No live sources retrieved", priority: 1 }]
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
        items: [
          {
            research_question_id: qid,
            status: degraded ? ("missing" as const) : ("partial" as const),
          },
        ],
        coverage_score,
        completed_areas: [],
        partial_areas: degraded ? [] : ["overview"],
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
        ? "Research lite returned no web sources; Writing must not invent citations."
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
}
