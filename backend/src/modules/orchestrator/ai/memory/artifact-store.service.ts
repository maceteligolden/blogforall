import { injectable } from "tsyringe";
import type { ContentOptimizationReport } from "../contracts/content-optimization";
import type { MemoryRecord } from "../contracts/memory-record";
import type { ResearchPackage, ResearchPackageSummary } from "../contracts/research-package";
import { MemoryRecordRepository } from "../../repositories/memory-record.repository";
import { OptimizationReportRepository } from "../../repositories/optimization-report.repository";
import { ResearchPackageRepository } from "../../repositories/research-package.repository";

export type ArtifactPersistOpts = {
  created_by?: string;
  thread_id?: string;
  workspace_id?: string;
};

/**
 * Content Memory / artifact persistence port (docs 15–18).
 * Skills and graph persist nodes call this instead of raw models.
 */
@injectable()
export class ArtifactStoreService {
  constructor(
    private readonly packages: ResearchPackageRepository,
    private readonly reports: OptimizationReportRepository,
    private readonly memoryRecords: MemoryRecordRepository
  ) {}

  async saveResearchPackage(pkg: ResearchPackage, opts?: ArtifactPersistOpts): Promise<{ package_id: string }> {
    const saved = await this.packages.save(pkg, opts);
    return { package_id: saved.package_id };
  }

  async getResearchPackage(workspaceId: string, packageId: string): Promise<ResearchPackage | null> {
    return this.packages.findById(workspaceId, packageId);
  }

  async listResearchSummaries(workspaceId: string, limit?: number): Promise<ResearchPackageSummary[]> {
    return this.packages.listRecent(workspaceId, limit);
  }

  async saveOptimizationReport(
    workspaceId: string,
    report: ContentOptimizationReport,
    opts?: ArtifactPersistOpts
  ): Promise<{ report_id: string }> {
    const saved = await this.reports.save(workspaceId, report, opts);
    return { report_id: saved.report_id };
  }

  async getOptimizationReport(workspaceId: string, reportId: string): Promise<ContentOptimizationReport | null> {
    return this.reports.findById(workspaceId, reportId);
  }

  async upsertMemoryRecord(record: MemoryRecord): Promise<MemoryRecord> {
    return this.memoryRecords.upsert(record);
  }

  async getMemoryByKey(
    workspaceId: string,
    layer: MemoryRecord["layer"],
    key: string,
    userId?: string | null
  ): Promise<MemoryRecord | null> {
    return this.memoryRecords.getByKey(workspaceId, layer, key, userId);
  }

  async listMemoryByLayer(
    workspaceId: string,
    layer: MemoryRecord["layer"],
    opts?: { userId?: string; limit?: number }
  ): Promise<MemoryRecord[]> {
    return this.memoryRecords.listByLayer(workspaceId, layer, opts);
  }
}
