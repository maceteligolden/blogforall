import { injectable } from "tsyringe";
import type { ResearchPackage, ResearchPackageSummary } from "../../contracts/research-package";
import { ResearchFullService } from "./research-full.service";
import { ResearchLiteService } from "./research-lite.service";

export type ResearchSkillInput = {
  workspace_id: string;
  topic: string;
  depth: "lite" | "full";
  audience?: string;
  search_intent?: string;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
};

export type ResearchSkillResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  depth: "lite" | "full";
  coverage_retries?: number;
  persisted: boolean;
};

/** Facade: select lite vs full Research and persist by default. */
@injectable()
export class ResearchSkillService {
  constructor(
    private readonly lite: ResearchLiteService,
    private readonly full: ResearchFullService,
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
      };
    }
    const result = await this.lite.run(input);
    return {
      package: result.package,
      summary: result.summary,
      provenance_errors: result.provenance_errors,
      depth: "lite",
      persisted: Boolean(result.persisted),
    };
  }
}
