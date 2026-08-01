import { injectable } from "tsyringe";
import { TavilySearchService } from "../../../../blog/ai/tavily-search.service";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import { skipsHowToResearch, type PostFormat } from "../../contracts/post-format";
import type { ResearchPackage, ResearchPackageSummary } from "../../contracts/research-package";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "./build-package";

export type ResearchLiteInput = {
  workspace_id: string;
  topic: string;
  audience?: string;
  search_intent?: string;
  post_format?: PostFormat;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
};

export type ResearchLiteResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  persisted?: boolean;
};

/**
 * Research skill — lite depth (doc 16).
 * Owns web search; Writing must never call Tavily.
 * Personal/linkedin formats skip web search and return a conversation-constraint package.
 */
@injectable()
export class ResearchLiteService {
  constructor(
    private readonly tavily: TavilySearchService,
    private readonly artifacts: ArtifactStoreService,
  ) {}

  async run(input: ResearchLiteInput): Promise<ResearchLiteResult> {
    const topic = input.topic.trim();
    const narrativeOnly = skipsHowToResearch(input.post_format);
    const notes = narrativeOnly ? [] : await this.tavily.search(topic, input.signal);
    const built = buildResearchPackageFromNotes({
      workspace_id: input.workspace_id,
      topic,
      depth: "lite",
      audience: input.audience,
      search_intent: input.search_intent,
      notes,
      max_sources: MVP_LOCKS.researchSourcesLiteMax,
      post_format: input.post_format,
    });

    let persisted = false;
    if (input.persist !== false) {
      await this.artifacts.saveResearchPackage(built.package, {
        created_by: input.created_by,
        thread_id: input.thread_id,
      });
      persisted = true;
    }

    return { ...built, persisted };
  }
}
