import { injectable } from "tsyringe";
import WorkspaceStrategyModel, {
  type WorkspaceStrategy,
  type WorkspaceStrategySource,
} from "../../../shared/schemas/workspace-strategy.schema";
import { NotFoundError } from "../../../shared/errors";

@injectable()
export class WorkspaceStrategyRepository {
  async findActive(siteId: string): Promise<WorkspaceStrategy | null> {
    return WorkspaceStrategyModel.findOne({ site_id: siteId, status: "active" });
  }

  async listVersions(siteId: string, limit = 20): Promise<WorkspaceStrategy[]> {
    return WorkspaceStrategyModel.find({ site_id: siteId }).sort({ version: -1 }).limit(limit);
  }

  async nextVersion(siteId: string): Promise<number> {
    const latest = await WorkspaceStrategyModel.findOne({ site_id: siteId }).sort({ version: -1 }).select("version");
    return (latest?.version ?? 0) + 1;
  }

  async create(data: Partial<WorkspaceStrategy>): Promise<WorkspaceStrategy> {
    const doc = new WorkspaceStrategyModel(data);
    return doc.save();
  }

  async updateActive(
    siteId: string,
    patch: Partial<WorkspaceStrategy>,
    userId?: string
  ): Promise<WorkspaceStrategy> {
    const updated = await WorkspaceStrategyModel.findOneAndUpdate(
      { site_id: siteId, status: "active" },
      { $set: { ...patch, updated_by: userId, updated_at: new Date() } },
      { new: true }
    );
    if (!updated) throw new NotFoundError("Active workspace strategy not found");
    return updated;
  }

  async archiveActive(siteId: string): Promise<void> {
    await WorkspaceStrategyModel.updateMany(
      { site_id: siteId, status: "active" },
      { $set: { status: "archived", updated_at: new Date() } }
    );
  }
}

export type { WorkspaceStrategy, WorkspaceStrategySource };
