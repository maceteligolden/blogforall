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
