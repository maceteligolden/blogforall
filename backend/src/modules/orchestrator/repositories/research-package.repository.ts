import { injectable } from "tsyringe";
import ResearchPackageModel, { type ResearchPackageEntity } from "../../../shared/schemas/research-package.schema";
import {
  researchPackageSchema,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../ai/contracts/research-package";

@injectable()
export class ResearchPackageRepository {
  async save(pkg: ResearchPackage, opts?: { created_by?: string; thread_id?: string }): Promise<ResearchPackageEntity> {
    const parsed = researchPackageSchema.parse(pkg);
    const summary: ResearchPackageSummary = {
      topic: parsed.topic,
      depth: parsed.depth,
      coverage_score: parsed.coverage.coverage_score,
      source_count: parsed.sources.length,
      contradiction_count: parsed.contradictions.length,
      degraded: parsed.degraded,
    };
    return ResearchPackageModel.findOneAndUpdate(
      { package_id: parsed.id },
      {
        package_id: parsed.id,
        workspace_id: parsed.workspace_id,
        depth: parsed.depth,
        topic: parsed.topic,
        coverage_score: parsed.coverage.coverage_score,
        source_count: parsed.sources.length,
        degraded: parsed.degraded,
        summary,
        package: parsed as unknown as Record<string, unknown>,
        created_by: opts?.created_by,
        thread_id: opts?.thread_id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  async findById(workspaceId: string, packageId: string): Promise<ResearchPackage | null> {
    const doc = await ResearchPackageModel.findOne({
      package_id: packageId,
      workspace_id: workspaceId,
    }).lean();
    if (!doc?.package) return null;
    return researchPackageSchema.parse(doc.package);
  }

  async listRecent(workspaceId: string, limit = 20): Promise<ResearchPackageSummary[]> {
    const docs = await ResearchPackageModel.find({ workspace_id: workspaceId })
      .sort({ created_at: -1 })
      .limit(limit)
      .select("summary")
      .lean();
    return docs.map((d) => d.summary);
  }
}
