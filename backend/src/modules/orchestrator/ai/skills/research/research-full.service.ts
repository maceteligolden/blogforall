import { injectable } from "tsyringe";
import { TavilySearchService } from "../../../../blog/ai/tavily-search.service";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import { skipsHowToResearch, type PostFormat } from "../../contracts/post-format";
import {
  needsCoverageRetry,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../../contracts/research-package";
import type { PhaseListener } from "../../observability/phase-emitter";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "./build-package";

export type ResearchFullInput = {
  workspace_id: string;
  topic: string;
  audience?: string;
  search_intent?: string;
  post_format?: PostFormat;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
  onPhase?: PhaseListener;
};

export type ResearchFullResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  coverage_retries: number;
  persisted: boolean;
};

/**
 * Research skill — full depth (simplified phases for M2; not the full 14-phase graph yet).
 * Multi-query search + coverage retry once when below coverage_min.
 */
@injectable()
export class ResearchFullService {
  constructor(
    private readonly tavily: TavilySearchService,
    private readonly artifacts: ArtifactStoreService
  ) {}

  async run(input: ResearchFullInput): Promise<ResearchFullResult> {
    const topic = input.topic.trim();
    const emit = input.onPhase;
    const narrativeOnly = skipsHowToResearch(input.post_format);

    const queries = narrativeOnly ? [] : [topic, `${topic} best practices`, `${topic} limitations OR pitfalls`];

    emit?.({
      phase: "research_planning",
      message: narrativeOnly
        ? "Skipping how-to web research for personal/narrative format"
        : `Planning ${queries.length} research queries`,
      skill_id: "research",
      percent: 10,
      meta: { query_count: queries.length, post_format: input.post_format },
    });

    emit?.({
      phase: "research_gathering",
      message: narrativeOnly ? "No web gather for narrative format" : "Gathering sources",
      skill_id: "research",
      percent: 35,
    });
    const notes = narrativeOnly ? [] : await this.searchAll(queries, input.signal);

    emit?.({
      phase: "research_structuring",
      message: `Structuring ${notes.length} sources into package`,
      skill_id: "research",
      percent: 65,
      meta: { source_count: notes.length },
    });
    let coverage_retries = 0;
    let built = buildResearchPackageFromNotes({
      workspace_id: input.workspace_id,
      topic,
      depth: "full",
      audience: input.audience,
      search_intent: input.search_intent,
      notes,
      max_sources: MVP_LOCKS.researchSourcesFullMax,
      post_format: input.post_format,
    });

    if (
      !narrativeOnly &&
      needsCoverageRetry(
        "full",
        built.package.coverage.coverage_score,
        coverage_retries,
        MVP_LOCKS.coverageMin,
        MVP_LOCKS.researchCoverageRetryMax
      )
    ) {
      coverage_retries += 1;
      emit?.({
        phase: "research_gathering",
        message: "Coverage below minimum — one retry search",
        skill_id: "research",
        percent: 75,
        meta: { coverage_retries },
      });
      const gapQuery = `${topic} overview guide sources`;
      const extra = await this.tavily.search(gapQuery, input.signal);
      const seen = new Set(notes.map((n) => n.url));
      for (const n of extra) {
        if (!seen.has(n.url)) {
          notes.push(n);
          seen.add(n.url);
        }
      }
      built = buildResearchPackageFromNotes({
        workspace_id: input.workspace_id,
        topic,
        depth: "full",
        audience: input.audience,
        search_intent: input.search_intent,
        notes,
        max_sources: MVP_LOCKS.researchSourcesFullMax,
        post_format: input.post_format,
      });
    }

    emit?.({
      phase: "research_packaging",
      message: `Package ready (coverage ${built.summary.coverage_score.toFixed(2)})`,
      skill_id: "research",
      percent: 95,
      meta: {
        coverage_score: built.summary.coverage_score,
        source_count: built.summary.source_count,
        contradiction_count: built.summary.contradiction_count,
      },
    });

    let persisted = false;
    if (input.persist !== false) {
      await this.artifacts.saveResearchPackage(built.package, {
        created_by: input.created_by,
        thread_id: input.thread_id,
      });
      persisted = true;
    }

    return { ...built, coverage_retries, persisted };
  }

  private async searchAll(
    queries: string[],
    signal?: AbortSignal
  ): Promise<Array<{ url: string; title: string; snippet?: string }>> {
    const batches = await Promise.all(queries.map((q) => this.tavily.search(q, signal)));
    const seen = new Set<string>();
    const out: Array<{ url: string; title: string; snippet?: string }> = [];
    for (const batch of batches) {
      for (const n of batch) {
        if (seen.has(n.url)) continue;
        seen.add(n.url);
        out.push(n);
      }
    }
    return out;
  }
}
