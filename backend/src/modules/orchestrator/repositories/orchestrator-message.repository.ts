import { injectable } from "tsyringe";
import OrchestratorMessageModel, {
  OrchestratorMessage,
  OrchestratorMessageRole,
  OrchestratorToolCallRecord,
} from "../../../shared/schemas/orchestrator-message.schema";

@injectable()
export class OrchestratorMessageRepository {
  async create(input: {
    thread_id: string;
    site_id: string;
    role: OrchestratorMessageRole;
    content: string;
    tool_calls?: OrchestratorToolCallRecord[];
    tool_name?: string;
    pending_approval_id?: string;
  }): Promise<OrchestratorMessage> {
    const doc = new OrchestratorMessageModel({
      thread_id: input.thread_id,
      site_id: input.site_id,
      role: input.role,
      content: input.content,
      tool_calls: input.tool_calls,
      tool_name: input.tool_name,
      pending_approval_id: input.pending_approval_id,
    });
    return doc.save();
  }

  /**
   * Return chronological history for the supervisor. Caller is responsible
   * for any truncation/summarization; we just hand back what we have.
   */
  async listByThread(
    threadId: string,
    siteId: string,
    options: { limit?: number } = {}
  ): Promise<OrchestratorMessage[]> {
    const q = OrchestratorMessageModel.find({ thread_id: threadId, site_id: siteId }).sort({ created_at: 1 });
    if (options.limit) {
      // Get the latest N: sort desc, limit, then re-sort asc in memory.
      const latest = await OrchestratorMessageModel.find({ thread_id: threadId, site_id: siteId })
        .sort({ created_at: -1 })
        .limit(options.limit);
      return latest.reverse();
    }
    return q;
  }

  async countByThread(threadId: string, siteId: string): Promise<number> {
    return OrchestratorMessageModel.countDocuments({ thread_id: threadId, site_id: siteId });
  }

  /**
   * List threads whose message count exceeds `maxKeep`. Used by the nightly
   * hygiene job as a safety net if inline pruning missed a path.
   */
  async findThreadsExceedingMessageCount(
    maxKeep: number,
    limitThreads: number
  ): Promise<{ thread_id: string; site_id: string }[]> {
    const rows = await OrchestratorMessageModel.aggregate<{ _id: { t: string; s: string } }>([
      { $group: { _id: { t: "$thread_id", s: "$site_id" }, c: { $sum: 1 } } },
      { $match: { c: { $gt: maxKeep } } },
      { $sort: { c: -1 } },
      { $limit: Math.min(limitThreads, 1000) },
    ]);
    return rows.map((r) => ({
      thread_id: String(r._id.t),
      site_id: String(r._id.s),
    }));
  }

  /**
   * Keep the latest `maxKeep` messages (by created_at desc, _id desc) and
   * delete the rest. Returns how many documents were removed.
   */
  async pruneThreadToMaxKeep(threadId: string, siteId: string, maxKeep: number): Promise<number> {
    const keepers = await OrchestratorMessageModel.find({ thread_id: threadId, site_id: siteId })
      .sort({ created_at: -1, _id: -1 })
      .limit(maxKeep)
      .select("_id");
    const total = await this.countByThread(threadId, siteId);
    if (total <= maxKeep || keepers.length === 0) return 0;
    const keeperIds = keepers.map((d) => d._id);
    const res = await OrchestratorMessageModel.deleteMany({
      thread_id: threadId,
      site_id: siteId,
      _id: { $nin: keeperIds },
    });
    return res.deletedCount ?? 0;
  }

  /**
   * Recent orchestrator messages for a workspace (all threads), newest first
   * in the query then caller reverses for chronological rendering.
   */
  async listRecentForSite(
    siteId: string,
    since: Date,
    limit: number
  ): Promise<OrchestratorMessage[]> {
    return OrchestratorMessageModel.find({
      site_id: siteId,
      created_at: { $gte: since },
    })
      .sort({ created_at: -1 })
      .limit(Math.min(limit, 300));
  }

  /**
   * Find the most recent assistant message that left an unresolved pending
   * approval. Used to resolve in-chat confirmations on the next user turn.
   */
  async findLatestPendingApproval(
    threadId: string,
    siteId: string
  ): Promise<OrchestratorMessage | null> {
    return OrchestratorMessageModel.findOne({
      thread_id: threadId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      pending_approval_id: { $exists: true, $ne: null },
    }).sort({ created_at: -1 });
  }

  async deleteByThread(threadId: string, siteId: string): Promise<void> {
    await OrchestratorMessageModel.deleteMany({ thread_id: threadId, site_id: siteId });
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await OrchestratorMessageModel.deleteMany({ site_id: siteId });
  }
}
