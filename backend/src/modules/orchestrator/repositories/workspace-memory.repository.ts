import { injectable } from "tsyringe";
import WorkspaceMemoryModel, {
  WorkspaceMemory,
  WORKSPACE_MEMORY_DEFAULTS,
} from "../../../shared/schemas/workspace-memory.schema";

/**
 * Persistent, per-workspace memory used by the Workspace Orchestrator Agent.
 * Every read/write is scoped by `site_id` to enforce workspace isolation.
 */
@injectable()
export class WorkspaceMemoryRepository {
  /**
   * Fetch the memory document for a workspace. Returns null if the workspace
   * has not yet been onboarded; callers may then call `ensureForSite`.
   */
  async findBySiteId(siteId: string): Promise<WorkspaceMemory | null> {
    return WorkspaceMemoryModel.findOne({ site_id: siteId });
  }

  /**
   * Idempotently create the memory document for a workspace with sensible
   * defaults. Safe to call on every dashboard load.
   */
  async ensureForSite(siteId: string, updatedBy?: string): Promise<WorkspaceMemory> {
    const existing = await this.findBySiteId(siteId);
    if (existing) return existing;
    const doc = new WorkspaceMemoryModel({
      site_id: siteId,
      strategic: {
        target_audience: [],
        business_goals: [],
        seo_priorities: [],
        publishing_channels: [],
      },
      operational: {
        approval_rules: WORKSPACE_MEMORY_DEFAULTS.approval_rules,
        automation_settings: WORKSPACE_MEMORY_DEFAULTS.automation_settings,
        review_lead_time_hours: 72,
      },
      preferences: {},
      content_summary: "",
      performance_summary: {},
      memory_summary: "",
      version: 1,
      updated_by: updatedBy,
    });
    return doc.save();
  }

  /**
   * Apply a deep patch to the memory document, bumping `version` atomically.
   * Returns the updated document; throws if the workspace memory is missing.
   */
  async update(
    siteId: string,
    patch: Partial<Omit<WorkspaceMemory, "_id" | "site_id" | "version" | "created_at">>,
    updatedBy?: string
  ): Promise<WorkspaceMemory | null> {
    return WorkspaceMemoryModel.findOneAndUpdate(
      { site_id: siteId },
      {
        $set: {
          ...patch,
          updated_at: new Date(),
          ...(updatedBy ? { updated_by: updatedBy } : {}),
        },
        $inc: { version: 1 },
      },
      { new: true }
    );
  }

  /**
   * Oldest-updated memories first so nightly digest work is spread fairly
   * across workspaces (each successful digest bumps `updated_at`).
   */
  async findBatchForDigest(limit: number): Promise<Pick<WorkspaceMemory, "site_id" | "memory_summary" | "content_summary">[]> {
    const docs = await WorkspaceMemoryModel.find({})
      .sort({ updated_at: 1 })
      .limit(Math.min(limit, 500))
      .select("site_id memory_summary content_summary")
      .lean();
    return docs as Pick<WorkspaceMemory, "site_id" | "memory_summary" | "content_summary">[];
  }

  /**
   * Delete memory for a workspace. Used when a site is deleted.
   */
  async deleteBySiteId(siteId: string): Promise<void> {
    await WorkspaceMemoryModel.deleteOne({ site_id: siteId });
  }
}
