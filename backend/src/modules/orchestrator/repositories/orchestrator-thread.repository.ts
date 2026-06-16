import { injectable } from "tsyringe";
import OrchestratorThreadModel, {
  OrchestratorThread,
  OrchestratorThreadStatus,
} from "../../../shared/schemas/orchestrator-thread.schema";

@injectable()
export class OrchestratorThreadRepository {
  async create(input: {
    site_id: string;
    user_id: string;
    title?: string;
    is_onboarding?: boolean;
  }): Promise<OrchestratorThread> {
    const doc = new OrchestratorThreadModel({
      site_id: input.site_id,
      user_id: input.user_id,
      title: input.title || "New conversation",
      is_onboarding: !!input.is_onboarding,
      last_activity_at: new Date(),
    });
    return doc.save();
  }

  async findById(threadId: string, siteId: string): Promise<OrchestratorThread | null> {
    return OrchestratorThreadModel.findOne({ _id: threadId, site_id: siteId });
  }

  /**
   * Find the most recent active thread for a user in a workspace, if any.
   * Used to resume conversations on dashboard load.
   */
  async findLatestForUser(siteId: string, userId: string): Promise<OrchestratorThread | null> {
    return OrchestratorThreadModel.findOne({
      site_id: siteId,
      user_id: userId,
      status: OrchestratorThreadStatus.ACTIVE,
    }).sort({ last_activity_at: -1 });
  }

  async listForUser(
    siteId: string,
    userId: string,
    options: { limit?: number; includeArchived?: boolean } = {}
  ): Promise<OrchestratorThread[]> {
    const filter: Record<string, unknown> = { site_id: siteId, user_id: userId };
    if (!options.includeArchived) {
      filter.status = OrchestratorThreadStatus.ACTIVE;
    }
    return OrchestratorThreadModel.find(filter)
      .sort({ last_activity_at: -1 })
      .limit(Math.min(options.limit ?? 50, 200));
  }

  /**
   * Find the most recent onboarding thread for the user in this workspace.
   * Used by the onboarding flow so refreshes resume the same conversation.
   */
  async findOnboardingThread(siteId: string, userId: string): Promise<OrchestratorThread | null> {
    return OrchestratorThreadModel.findOne({
      site_id: siteId,
      user_id: userId,
      is_onboarding: true,
      status: OrchestratorThreadStatus.ACTIVE,
    }).sort({ last_activity_at: -1 });
  }

  async touch(threadId: string): Promise<void> {
    await OrchestratorThreadModel.updateOne(
      { _id: threadId },
      { $set: { last_activity_at: new Date(), updated_at: new Date() } }
    );
  }

  async rename(threadId: string, siteId: string, title: string): Promise<OrchestratorThread | null> {
    return OrchestratorThreadModel.findOneAndUpdate(
      { _id: threadId, site_id: siteId },
      { $set: { title, updated_at: new Date() } },
      { new: true }
    );
  }

  async archive(threadId: string, siteId: string): Promise<void> {
    await OrchestratorThreadModel.updateOne(
      { _id: threadId, site_id: siteId },
      { $set: { status: OrchestratorThreadStatus.ARCHIVED, updated_at: new Date() } }
    );
  }

  async markOnboardingComplete(threadId: string, siteId: string): Promise<void> {
    await OrchestratorThreadModel.updateOne(
      { _id: threadId, site_id: siteId },
      { $set: { is_onboarding: false, updated_at: new Date() } }
    );
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await OrchestratorThreadModel.deleteMany({ site_id: siteId });
  }
}
