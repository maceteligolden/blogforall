import { injectable } from "tsyringe";
import type { BlogReviewResult } from "../../../../blog/ai/blog-review.runner";
import {
  canOptimizeAgain,
  type ContentOptimizationReport,
} from "../../contracts/content-optimization";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import type { PhaseListener } from "../../observability/phase-emitter";
import { mapBlogReviewToOptimizationReport } from "./review-adapter";
import { buildThinOptimizationReport, type DraftForOptimize } from "./thin-validators";

export type ContentOptimizationInput = {
  draft: DraftForOptimize;
  draft_id?: string;
  research_package_id?: string;
  topic?: string;
  depth?: "lite" | "full";
  /** When set, use legacy review adapter instead of thin validators. */
  legacy_review?: BlogReviewResult;
  optimize_count?: number;
  factual_confidence?: number;
  workspace_id?: string;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
  post_format?: string;
  onPhase?: PhaseListener;
};

export type ContentOptimizationResult = {
  report: ContentOptimizationReport;
  should_revise: boolean;
  can_loop_again: boolean;
  persisted: boolean;
};

/**
 * Content Optimization skill (doc 17) — MVP thin validators + optional review adapter.
 */
@injectable()
export class ContentOptimizationService {
  constructor(private readonly artifacts: ArtifactStoreService) {}

  async run(input: ContentOptimizationInput): Promise<ContentOptimizationResult> {
    const optimize_count = input.optimize_count ?? 0;
    const emit = input.onPhase;

    emit?.({
      phase: "optimize_scoring",
      message: "Running SEO / GAO / readability validators",
      skill_id: "content_optimization",
      percent: 40,
    });

    const report = input.legacy_review
      ? mapBlogReviewToOptimizationReport({
          review: input.legacy_review,
          draft_id: input.draft_id,
          research_package_id: input.research_package_id,
        })
      : buildThinOptimizationReport({
          draft: input.draft,
          draft_id: input.draft_id,
          research_package_id: input.research_package_id,
          topic: input.topic,
          factual_confidence: input.factual_confidence,
          post_format: input.post_format,
        });

    const can_loop_again = canOptimizeAgain(optimize_count);
    const should_revise = !report.quality_gate_passed && can_loop_again;

    emit?.({
      phase: "optimize_gate",
      message: report.quality_gate_passed
        ? `Gate passed (overall ${report.quality.overall})`
        : `Gate failed (overall ${report.quality.overall})`,
      skill_id: "content_optimization",
      percent: 90,
      meta: {
        overall: report.quality.overall,
        seo: report.quality.seo,
        gao: report.quality.gao,
        quality_gate_passed: report.quality_gate_passed,
        critical_count: report.plan.critical.length,
      },
    });

    let persisted = false;
    if (input.persist !== false && input.workspace_id) {
      await this.artifacts.saveOptimizationReport(input.workspace_id, report, {
        created_by: input.created_by,
        thread_id: input.thread_id,
      });
      persisted = true;
    }

    return { report, should_revise, can_loop_again, persisted };
  }
}
