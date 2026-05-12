import { injectable } from "tsyringe";
import ScheduledPost, { ScheduledPost as ScheduledPostType } from "../../../shared/schemas/scheduled-post.schema";
import { ScheduledPostStatus } from "../../../shared/constants/campaign.constant";
import { PaginatedResponse } from "../../../shared/interfaces";
import { ScheduledPostQueryFilters } from "../interfaces/scheduled-post.interface";

@injectable()
export class ScheduledPostRepository {
  async create(postData: Partial<ScheduledPostType>): Promise<ScheduledPostType> {
    const post = new ScheduledPost(postData);
    return post.save();
  }

  async findById(id: string, siteId?: string): Promise<ScheduledPostType | null> {
    const query: Record<string, unknown> = { _id: id };
    if (siteId) {
      query.site_id = siteId;
    }
    return ScheduledPost.findOne(query);
  }

  async findByBlog(blogId: string): Promise<ScheduledPostType[]> {
    return ScheduledPost.find({ blog_id: blogId });
  }

  async findByCampaign(campaignId: string, siteId?: string): Promise<ScheduledPostType[]> {
    const query: Record<string, unknown> = { campaign_id: campaignId };
    if (siteId) {
      query.site_id = siteId;
    }
    return ScheduledPost.find(query).sort({ scheduled_at: 1 });
  }

  async findByUser(userId: string, siteId: string, filters?: ScheduledPostQueryFilters): Promise<ScheduledPostType[]> {
    const query: Record<string, unknown> = { user_id: userId, site_id: siteId };

    if (filters?.campaign_id) {
      query.campaign_id = filters.campaign_id;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.scheduled_at_from) {
      query.scheduled_at = {
        ...((query.scheduled_at as Record<string, unknown>) || {}),
        $gte: filters.scheduled_at_from,
      };
    }
    if (filters?.scheduled_at_to) {
      query.scheduled_at = {
        ...((query.scheduled_at as Record<string, unknown>) || {}),
        $lte: filters.scheduled_at_to,
      };
    }

    return ScheduledPost.find(query).sort({ scheduled_at: 1 });
  }

  async findAll(siteId: string, filters?: ScheduledPostQueryFilters): Promise<PaginatedResponse<ScheduledPostType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { site_id: siteId };

    if (filters?.campaign_id) {
      query.campaign_id = filters.campaign_id;
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.scheduled_at_from) {
      query.scheduled_at = {
        ...((query.scheduled_at as Record<string, unknown>) || {}),
        $gte: filters.scheduled_at_from,
      };
    }
    if (filters?.scheduled_at_to) {
      query.scheduled_at = {
        ...((query.scheduled_at as Record<string, unknown>) || {}),
        $lte: filters.scheduled_at_to,
      };
    }

    const [data, total] = await Promise.all([
      ScheduledPost.find(query).sort({ scheduled_at: 1 }).skip(skip).limit(limit),
      ScheduledPost.countDocuments(query),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, siteId: string, updateData: Partial<ScheduledPostType>): Promise<ScheduledPostType | null> {
    return ScheduledPost.findOneAndUpdate({ _id: id, site_id: siteId }, { $set: updateData }, { new: true });
  }

  async delete(id: string, siteId: string): Promise<boolean> {
    const result = await ScheduledPost.deleteOne({ _id: id, site_id: siteId });
    return result.deletedCount > 0;
  }

  async findPendingPosts(limit: number = 100): Promise<ScheduledPostType[]> {
    const now = new Date();
    return ScheduledPost.find({
      status: { $in: [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED] },
      scheduled_at: { $lte: now },
    })
      .sort({ scheduled_at: 1 })
      .limit(limit);
  }

  /**
   * Posts that are eligible for the pre-publish "prepare" phase: they are
   * still PENDING/SCHEDULED, do not have a `prepared_at` timestamp yet, and
   * are within `leadTimeMs` of their scheduled publish time. The prepare
   * worker will (re)generate content if needed, transition them to
   * AWAITING_APPROVAL, and mint a review token.
   */
  async findDueForPreparation(leadTimeMs: number, limit: number = 50): Promise<ScheduledPostType[]> {
    const horizon = new Date(Date.now() + leadTimeMs);
    return ScheduledPost.find({
      status: { $in: [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED] },
      scheduled_at: { $lte: horizon },
      $or: [{ prepared_at: { $exists: false } }, { prepared_at: null }],
    })
      .sort({ scheduled_at: 1 })
      .limit(limit);
  }

  /**
   * Posts that have human approval and have reached their publish time.
   * Used by the publish worker; AWAITING_APPROVAL posts without
   * `approved_at` are intentionally excluded so unreviewed drafts never
   * auto-publish even after their scheduled time elapses.
   */
  async findReadyForPublication(limit: number = 100): Promise<ScheduledPostType[]> {
    const now = new Date();
    return ScheduledPost.find({
      status: ScheduledPostStatus.AWAITING_APPROVAL,
      approved_at: { $exists: true, $ne: null },
      scheduled_at: { $lte: now },
    })
      .sort({ scheduled_at: 1 })
      .limit(limit);
  }

  /**
   * Atomically transition a scheduled post into the AWAITING_APPROVAL state
   * once the prepare worker has produced a draft. Returns the updated row,
   * or null if a concurrent worker already prepared it.
   */
  async markPrepared(
    id: string,
    siteId: string,
    update: { blog_id?: string }
  ): Promise<ScheduledPostType | null> {
    return ScheduledPost.findOneAndUpdate(
      {
        _id: id,
        site_id: siteId,
        status: { $in: [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED] },
      },
      {
        $set: {
          ...update,
          status: ScheduledPostStatus.AWAITING_APPROVAL,
          prepared_at: new Date(),
          updated_at: new Date(),
          // Clear any prior error so retries don't carry old context forward.
          error_message: undefined,
        },
      },
      { new: true }
    );
  }

  /**
   * Atomically record the reviewer's approval. Returns null if the post is
   * not currently AWAITING_APPROVAL (e.g. already approved on another tab).
   */
  async markApproved(
    id: string,
    siteId: string,
    approverUserId: string
  ): Promise<ScheduledPostType | null> {
    return ScheduledPost.findOneAndUpdate(
      {
        _id: id,
        site_id: siteId,
        status: ScheduledPostStatus.AWAITING_APPROVAL,
      },
      {
        $set: {
          approved_at: new Date(),
          approved_by_user_id: approverUserId,
          updated_at: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Transition a post into the rework loop. Increments `rework_round` so the
   * next prepare pass can mint a fresh review token tied to the new round
   * and so existing tokens (matched against rework_round) are unambiguously
   * stale.
   */
  async markReworkRequested(
    id: string,
    siteId: string,
    comments: string,
    requesterUserId: string
  ): Promise<ScheduledPostType | null> {
    return ScheduledPost.findOneAndUpdate(
      {
        _id: id,
        site_id: siteId,
        status: ScheduledPostStatus.AWAITING_APPROVAL,
      },
      {
        $set: {
          status: ScheduledPostStatus.REWORK_REQUESTED,
          rework_comments: comments,
          approved_at: undefined,
          approved_by_user_id: requesterUserId,
          prepared_at: undefined,
          updated_at: new Date(),
        },
        $inc: { rework_round: 1 },
      },
      { new: true }
    );
  }

  async findByDateRange(siteId: string, startDate: Date, endDate: Date): Promise<ScheduledPostType[]> {
    return ScheduledPost.find({
      site_id: siteId,
      scheduled_at: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("blog_id", "title slug status excerpt")
      .populate("campaign_id", "name goal")
      .sort({ scheduled_at: 1 });
  }

  async markAsPublished(id: string, publishedAt: Date): Promise<void> {
    await ScheduledPost.updateOne(
      { _id: id },
      {
        $set: {
          status: ScheduledPostStatus.PUBLISHED,
          published_at: publishedAt,
        },
      }
    );
  }

  async markAsFailed(id: string, errorMessage: string): Promise<void> {
    await ScheduledPost.updateOne(
      { _id: id },
      {
        $set: {
          status: ScheduledPostStatus.FAILED,
          error_message: errorMessage,
          last_attempt_at: new Date(),
        },
        $inc: { publish_attempts: 1 },
      }
    );
  }

  async incrementAttempts(id: string): Promise<void> {
    await ScheduledPost.updateOne(
      { _id: id },
      {
        $set: { last_attempt_at: new Date() },
        $inc: { publish_attempts: 1 },
      }
    );
  }

  async countByCampaign(campaignId: string, status?: ScheduledPostStatus): Promise<number> {
    const query: Record<string, unknown> = { campaign_id: campaignId };
    if (status) {
      query.status = status;
    }
    return ScheduledPost.countDocuments(query);
  }

  async isBlogScheduled(blogId: string): Promise<boolean> {
    const count = await ScheduledPost.countDocuments({
      blog_id: blogId,
      status: { $in: [ScheduledPostStatus.PENDING, ScheduledPostStatus.SCHEDULED] },
    });
    return count > 0;
  }
}
