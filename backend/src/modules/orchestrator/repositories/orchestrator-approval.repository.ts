import { injectable } from "tsyringe";
import OrchestratorApprovalModel, {
  OrchestratorApproval,
  OrchestratorApprovalKind,
  OrchestratorApprovalStatus,
} from "../../../shared/schemas/orchestrator-approval.schema";

@injectable()
export class OrchestratorApprovalRepository {
  async create(input: {
    site_id: string;
    thread_id?: string;
    requested_for_user_id: string;
    requested_by_user_id: string;
    kind: OrchestratorApprovalKind;
    action: string;
    summary: string;
    payload: Record<string, unknown>;
    expires_at?: Date;
  }): Promise<OrchestratorApproval> {
    const doc = new OrchestratorApprovalModel({
      ...input,
      status: OrchestratorApprovalStatus.PENDING,
      requested_at: new Date(),
    });
    return doc.save();
  }

  async findById(approvalId: string, siteId: string): Promise<OrchestratorApproval | null> {
    return OrchestratorApprovalModel.findOne({ _id: approvalId, site_id: siteId });
  }

  async findPendingForThread(threadId: string, siteId: string): Promise<OrchestratorApproval | null> {
    return OrchestratorApprovalModel.findOne({
      thread_id: threadId,
      site_id: siteId,
      status: OrchestratorApprovalStatus.PENDING,
    }).sort({ requested_at: -1 });
  }

  async listForUser(
    siteId: string,
    userId: string,
    options: { status?: OrchestratorApprovalStatus; limit?: number } = {}
  ): Promise<OrchestratorApproval[]> {
    const filter: Record<string, unknown> = { site_id: siteId, requested_for_user_id: userId };
    if (options.status) {
      filter.status = options.status;
    }
    return OrchestratorApprovalModel.find(filter)
      .sort({ requested_at: -1 })
      .limit(Math.min(options.limit ?? 100, 500));
  }

  async listPendingForSite(siteId: string, limit = 200): Promise<OrchestratorApproval[]> {
    return OrchestratorApprovalModel.find({
      site_id: siteId,
      status: OrchestratorApprovalStatus.PENDING,
    })
      .sort({ requested_at: -1 })
      .limit(Math.min(limit, 500));
  }

  /**
   * Atomically transition a pending approval to approved/rejected. Returns
   * null if the approval was already decided (avoids double-execution).
   */
  async decide(
    approvalId: string,
    siteId: string,
    decision: OrchestratorApprovalStatus.APPROVED | OrchestratorApprovalStatus.REJECTED,
    decidedByUserId: string,
    decisionNote?: string
  ): Promise<OrchestratorApproval | null> {
    return OrchestratorApprovalModel.findOneAndUpdate(
      { _id: approvalId, site_id: siteId, status: OrchestratorApprovalStatus.PENDING },
      {
        $set: {
          status: decision,
          decided_at: new Date(),
          decided_by_user_id: decidedByUserId,
          ...(decisionNote ? { decision_note: decisionNote } : {}),
          updated_at: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Record execution outcome after running the approved action. Sets status
   * to EXECUTED. Idempotent: re-calling on an already-executed row is a no-op
   * (Mongo's $set overwrites with the same data).
   */
  async markExecuted(
    approvalId: string,
    siteId: string,
    result: NonNullable<OrchestratorApproval["execution_result"]>
  ): Promise<OrchestratorApproval | null> {
    return OrchestratorApprovalModel.findOneAndUpdate(
      { _id: approvalId, site_id: siteId },
      {
        $set: {
          status: OrchestratorApprovalStatus.EXECUTED,
          execution_result: result,
          updated_at: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Expire any pending approvals whose expires_at has passed. Called by the
   * orchestrator on every supervisor turn so timeouts surface immediately.
   */
  async expireDue(siteId?: string): Promise<number> {
    const filter: Record<string, unknown> = {
      status: OrchestratorApprovalStatus.PENDING,
      expires_at: { $lte: new Date() },
    };
    if (siteId) filter.site_id = siteId;
    const result = await OrchestratorApprovalModel.updateMany(filter, {
      $set: {
        status: OrchestratorApprovalStatus.EXPIRED,
        decided_at: new Date(),
        updated_at: new Date(),
      },
    });
    return result.modifiedCount ?? 0;
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await OrchestratorApprovalModel.deleteMany({ site_id: siteId });
  }
}
