import { randomUUID } from "crypto";
import type { ResearchPackage, ResearchPackageSummary } from "../../orchestrator/ai/contracts/research-package";
import type {
  ResearchBriefState,
  ResearchClaim,
  ResearchCriticNotes,
  ResearchDepth,
  ResearchDocument,
  ResearchFinding,
  ResearchPurpose,
  ResearchSearchRecord,
  ResearchSubquestion,
} from "./research.types";

export function mapGraphToPackage(args: {
  workspace_id: string;
  question: string;
  audience?: string;
  depth: ResearchDepth;
  purpose?: ResearchPurpose;
  brief: ResearchBriefState;
  subquestions: ResearchSubquestion[];
  searches: ResearchSearchRecord[];
  documents: ResearchDocument[];
  claims: ResearchClaim[];
  findings: ResearchFinding[];
  critic: ResearchCriticNotes | null;
  report_markdown: string;
  spoken_summary: string;
  degraded: boolean;
}): ResearchPackage {
  const now = new Date().toISOString();
  const sources = args.documents.map((d) => ({
    id: d.id,
    url: d.url,
    title: d.title || d.url,
    snippet: d.snippet,
    category: d.tier === 1 ? ("official_docs" as const) : d.tier === 3 ? ("other" as const) : ("engineering_blog" as const),
    quality_score: d.quality_score,
    quality_rationale: `tier ${d.tier}`,
    freshness: "recent" as const,
    retrieved_at: now,
    tier: d.tier,
  }));
  const sourceIds = new Set(sources.map((s) => s.id));
  const fallbackSourceId = sources[0]?.id ?? "src_unknown";

  const toFact = (claim: ResearchClaim, kind: "definition" | "fact" | "statistic" | "limitation" | "opinion") => ({
    id: claim.id,
    kind,
    text: claim.claim,
    source_id: claim.source_ids.find((id) => sourceIds.has(id)) ?? fallbackSourceId,
    confidence: claim.confidence,
    freshness: "recent" as const,
    research_question_ids: claim.subquestion_ids,
  });

  const definitions = args.claims.filter((c) => c.kind === "definition").map((c) => toFact(c, "definition"));
  const statistics = args.claims.filter((c) => c.kind === "statistic").map((c) => toFact(c, "statistic"));
  const limitations = args.claims.filter((c) => c.kind === "limitation").map((c) => toFact(c, "limitation"));
  const opinions = args.claims.filter((c) => c.kind === "opinion" || c.kind === "interpretation").map((c) => toFact(c, "opinion"));
  const facts = args.claims
    .filter((c) => c.kind === "fact" || (!["definition", "statistic", "limitation", "opinion", "interpretation"].includes(c.kind)))
    .map((c) => toFact(c, "fact"));

  const contradictions = args.claims
    .filter((c) => c.contradicting_evidence.length > 0)
    .map((c) => ({
      id: `ctr_${c.id}`,
      claim_a: c.claim,
      claim_b: c.contradicting_evidence[0] ?? "Conflicting evidence",
      evidence_a_ids: c.source_ids.length ? c.source_ids : [fallbackSourceId],
      evidence_b_ids: c.source_ids.length ? c.source_ids : [fallbackSourceId],
      confidence: 1 - c.confidence,
      explanation: c.contradicting_evidence.join(" "),
    }));

  const coverageItems = args.subquestions.map((q) => ({
    research_question_id: q.id,
    status: q.covered ? ("completed" as const) : ("partial" as const),
    notes: q.category,
  }));
  const covered = coverageItems.filter((i) => i.status === "completed").length;
  const coverage_score =
    coverageItems.length === 0 ? (args.documents.length > 0 ? 0.6 : 0.2) : covered / coverageItems.length;

  const mean_source_quality =
    sources.length === 0 ? 0 : sources.reduce((s, x) => s + x.quality_score, 0) / sources.length;
  const allFacts = [...definitions, ...facts, ...statistics, ...limitations, ...opinions];
  const mean_fact_confidence =
    allFacts.length === 0 ? 0 : allFacts.reduce((s, x) => s + x.confidence, 0) / allFacts.length;

  const evidence_graph = {
    nodes: [
      ...sources.map((s) => ({
        id: `n_${s.id}`,
        type: "source" as const,
        label: s.title,
        ref_id: s.id,
        confidence: s.quality_score,
      })),
      ...args.claims.map((c) => ({
        id: `n_${c.id}`,
        type: "claim" as const,
        label: c.claim.slice(0, 120),
        ref_id: c.id,
        confidence: c.confidence,
      })),
    ],
    edges: args.claims.flatMap((c) =>
      c.source_ids.map((sid, i) => ({
        id: `e_${c.id}_${i}`,
        from: `n_${sid}`,
        to: `n_${c.id}`,
        type: "supports" as const,
      })),
    ),
  };

  return {
    version: 2,
    id: `rp_${randomUUID()}`,
    workspace_id: args.workspace_id,
    created_at: now,
    depth: args.depth,
    topic: args.question.slice(0, 500),
    audience: args.audience?.trim() || "general",
    search_intent: args.purpose && args.purpose !== "general" ? args.purpose : "informational",
    research_questions: args.subquestions.map((q, i) => ({
      id: q.id,
      question: q.question,
      priority: i + 1,
    })),
    knowledge_gaps: (args.critic?.unknowns ?? []).map((u, i) => ({
      id: `gap_${i + 1}`,
      description: u,
      priority: i + 1,
    })),
    definitions,
    facts,
    statistics,
    examples: [],
    expert_opinions: opinions,
    recent_developments: [],
    entities: [],
    relationships: [],
    contradictions,
    evidence_graph,
    sources,
    references: sources.map((s) => ({ source_id: s.id, url: s.url, title: s.title })),
    coverage: {
      items: coverageItems,
      coverage_score,
      completed_areas: coverageItems.filter((i) => i.status === "completed").map((i) => i.research_question_id),
      partial_areas: coverageItems.filter((i) => i.status === "partial").map((i) => i.research_question_id),
      missing_areas: [],
    },
    confidence_summary: {
      mean_source_quality,
      mean_fact_confidence,
      contradiction_count: contradictions.length,
    },
    degraded: args.degraded,
    disclosure: args.degraded
      ? "Web search returned limited sources. Treat findings as provisional."
      : undefined,
    brief: args.brief,
    searches: args.searches,
    documents: args.documents,
    claims: args.claims,
    findings: args.findings,
    critic_notes: args.critic ?? undefined,
    report_markdown: args.report_markdown,
    spoken_summary: args.spoken_summary,
  } as ResearchPackage;
}

export function packageSummary(pkg: ResearchPackage): ResearchPackageSummary {
  return {
    topic: pkg.topic,
    depth: pkg.depth,
    coverage_score: pkg.coverage.coverage_score,
    source_count: pkg.sources.length,
    contradiction_count: pkg.contradictions.length,
    degraded: pkg.degraded,
  };
}

export function formatPackageForPrompt(pkg: ResearchPackage): string {
  const extra = pkg as ResearchPackage & { report_markdown?: string; findings?: ResearchFinding[] };
  if (extra.report_markdown?.trim()) {
    return extra.report_markdown.slice(0, 8000);
  }
  const facts = [...pkg.facts, ...pkg.statistics, ...pkg.definitions].slice(0, 12);
  const lines = facts.map((f, i) => `${i + 1}. ${f.text} (confidence ${f.confidence.toFixed(2)})`);
  const refs = pkg.references.slice(0, 8).map((r, i) => `[${i + 1}] ${r.title} — ${r.url}`);
  return `Research findings:\n${lines.join("\n") || "(none)"}\n\nSources:\n${refs.join("\n") || "(none)"}`;
}
