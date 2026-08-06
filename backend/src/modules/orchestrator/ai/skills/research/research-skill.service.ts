import { injectable } from "tsyringe";
import type { PostFormat } from "../../contracts/post-format";
import type { ResearchPackage, ResearchPackageSummary } from "../../contracts/research-package";
import type { PhaseListener } from "../../observability/phase-emitter";
import type { ContentArchetype } from "../../../../blog/ai/contracts/content-archetype";
import type { FirstPartyPriors, ResearchBrief, ResearchScope } from "../../../../blog/ai/contracts/research-brief";
import { ResearchFullService } from "./research-full.service";
import { ResearchLiteService } from "./research-lite.service";

export type ResearchSkillInput = {
  workspace_id: string;
  topic: string;
  depth: "lite" | "full";
  audience?: string;
  search_intent?: string;
  post_format?: PostFormat;
  content_archetype?: ContentArchetype | string;
  personal_notes?: string;
  must_include?: string;
  clarify_choice?: string;
  resolved_scope?: ResearchScope;
  first_party?: FirstPartyPriors;
  allow_guess?: boolean;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
  onPhase?: PhaseListener;
};

export type ResearchSkillResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  depth: "lite" | "full";
  coverage_retries?: number;
  persisted: boolean;
  research_brief: ResearchBrief;
  needs_clarification: boolean;
};

/** Facade: select lite vs full Research and persist by default. */
@injectable()
export class ResearchSkillService {
  constructor(
    private readonly lite: ResearchLiteService,
    private readonly full: ResearchFullService
  ) {}

  async run(input: ResearchSkillInput): Promise<ResearchSkillResult> {
    if (input.depth === "full") {
      const result = await this.full.run(input);
      return {
        package: result.package,
        summary: result.summary,
        provenance_errors: result.provenance_errors,
        depth: "full",
        coverage_retries: result.coverage_retries,
        persisted: result.persisted,
        research_brief: result.research_brief,
        needs_clarification: result.needs_clarification,
      };
    }
    const result = await this.lite.run(input);
    return {
      package: result.package,
      summary: result.summary,
      provenance_errors: result.provenance_errors,
      depth: "lite",
      persisted: Boolean(result.persisted),
      research_brief: result.research_brief,
      needs_clarification: result.needs_clarification,
    };
  }
}
