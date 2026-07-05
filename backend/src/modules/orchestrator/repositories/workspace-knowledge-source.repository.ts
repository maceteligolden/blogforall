import { injectable } from "tsyringe";
import WorkspaceKnowledgeSourceModel, {
  type KnowledgeFileRef,
  type WorkspaceKnowledgeSource,
} from "../../../shared/schemas/workspace-knowledge-source.schema";

@injectable()
export class WorkspaceKnowledgeSourceRepository {
  async listForSite(siteId: string): Promise<WorkspaceKnowledgeSource[]> {
    return WorkspaceKnowledgeSourceModel.find({ site_id: siteId, status: "active" }).sort({
      updated_at: -1,
    });
  }

  async create(input: {
    site_id: string;
    user_id: string;
    provider: WorkspaceKnowledgeSource["provider"];
    name: string;
    file_refs: KnowledgeFileRef[];
    config?: Record<string, unknown>;
  }): Promise<WorkspaceKnowledgeSource> {
    const doc = new WorkspaceKnowledgeSourceModel({
      ...input,
      status: "active",
    });
    return doc.save();
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const result = await WorkspaceKnowledgeSourceModel.deleteOne({ _id: id, site_id: siteId });
    return result.deletedCount > 0;
  }
}
