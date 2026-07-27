import { injectable } from "tsyringe";
import type { BlogReviewResult } from "../../../../blog/ai/blog-review.runner";
import {
  canOptimizeAgain,
  type ContentOptimizationReport,
} from "../../contracts/content-optimization";
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
};

export type ContentOptimizationResult = {
  report: ContentOptimizationReport;
  should_revise: boolean;
  can_loop_again: boolean;
};

/**
 * Content Optimization skill (doc 17) — MVP thin validators + optional review adapter.
 */
@injectable()
export class ContentOptimizationService {
  run(input: ContentOptimizationInput): ContentOptimizationResult {
    const optimize_count = input.optimize_count ?? 0;
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
        });

    const can_loop_again = canOptimizeAgain(optimize_count);
    const should_revise = !report.quality_gate_passed && can_loop_again;

    return { report, should_revise, can_loop_again };
  }
}
