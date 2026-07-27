import { injectable } from "tsyringe";
import { TavilySearchService } from "../../../../blog/ai/tavily-search.service";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import { needsCoverageRetry, type ResearchPackage, type ResearchPackageSummary } from "../../contracts/research-package";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "./build-package";

export type ResearchFullInput = {
  workspace_id: string;
  topic: string;
  audience?: string;
  search_intent?: string;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
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
    private readonly artifacts: ArtifactStoreService,
  ) {}

  async run(input: ResearchFullInput): Promise<ResearchFullResult> {
    const topic = input.topic.trim();
    const queries = [
      topic,
      `${topic} best practices`,
      `${topic} limitations OR pitfalls`,
    ];

    const notes = await this.searchAll(queries, input.signal);
    let coverage_retries = 0;
    let built = buildResearchPackageFromNotes({
      workspace_id: input.workspace_id,
      topic,
      depth: "full",
      audience: input.audience,
      search_intent: input.search_intent,
      notes,
      max_sources: MVP_LOCKS.researchSourcesFullMax,
    });

    if (
      needsCoverageRetry(
        "full",
        built.package.coverage.coverage_score,
        coverage_retries,
        MVP_LOCKS.coverageMin,
        MVP_LOCKS.researchCoverageRetryMax,
      )
    ) {
      coverage_retries += 1;
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
      });
    }

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
    signal?: AbortSignal,
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
