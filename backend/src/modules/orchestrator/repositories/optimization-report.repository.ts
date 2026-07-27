import { injectable } from "tsyringe";
import OptimizationReportModel, {
  type OptimizationReportEntity,
} from "../../../shared/schemas/optimization-report.schema";
import {
  contentOptimizationReportSchema,
  type ContentOptimizationReport,
} from "../ai/contracts/content-optimization";

@injectable()
export class OptimizationReportRepository {
  async save(
    workspaceId: string,
    report: ContentOptimizationReport,
    opts?: { created_by?: string; thread_id?: string },
  ): Promise<OptimizationReportEntity> {
    const parsed = contentOptimizationReportSchema.parse(report);
    return OptimizationReportModel.findOneAndUpdate(
      { report_id: parsed.id },
      {
        report_id: parsed.id,
        workspace_id: workspaceId,
        draft_id: parsed.draft_id,
        research_package_id: parsed.research_package_id,
        overall_score: parsed.quality.overall,
        quality_gate_passed: parsed.quality_gate_passed,
        critical_count: parsed.plan.critical.length,
        report: parsed as unknown as Record<string, unknown>,
        created_by: opts?.created_by,
        thread_id: opts?.thread_id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async findById(workspaceId: string, reportId: string): Promise<ContentOptimizationReport | null> {
    const doc = await OptimizationReportModel.findOne({
      report_id: reportId,
      workspace_id: workspaceId,
    }).lean();
    if (!doc?.report) return null;
    return contentOptimizationReportSchema.parse(doc.report);
  }

  async findLatestForDraft(
    workspaceId: string,
    draftId: string,
  ): Promise<ContentOptimizationReport | null> {
    const doc = await OptimizationReportModel.findOne({
      workspace_id: workspaceId,
      draft_id: draftId,
    })
      .sort({ created_at: -1 })
      .lean();
    if (!doc?.report) return null;
    return contentOptimizationReportSchema.parse(doc.report);
  }
}
