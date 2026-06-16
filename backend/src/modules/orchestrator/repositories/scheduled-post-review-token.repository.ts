import { injectable } from "tsyringe";
import ScheduledPostReviewTokenModel, {
  ReviewTokenAction,
  ScheduledPostReviewToken,
} from "../../../shared/schemas/scheduled-post-review-token.schema";
import { mintReviewToken, tokenLookupPrefix, verifyReviewToken } from "../utils/review-token";

@injectable()
export class ScheduledPostReviewTokenRepository {
  /**
   * Mint and persist a new review token. Returns BOTH the raw token (for the
   * email link) and the persisted row. The caller must never log `raw`.
   */
  async issue(input: {
    site_id: string;
    scheduled_post_id: string;
    user_id: string;
    rework_round: number;
    expires_at: Date;
  }): Promise<{ token: ScheduledPostReviewToken; raw: string }> {
    const { raw, lookup, hash } = mintReviewToken();
    const doc = await new ScheduledPostReviewTokenModel({
      site_id: input.site_id,
      scheduled_post_id: input.scheduled_post_id,
      user_id: input.user_id,
      token_lookup: lookup,
      token_hash: hash,
      expires_at: input.expires_at,
      rework_round: input.rework_round,
    }).save();
    return { token: doc, raw };
  }

  /**
   * Find a valid (unused, non-expired) token by its raw value. Returns null
   * on any mismatch or expiry. Constant-time hash compare for the candidate.
   */
  async findValid(raw: string): Promise<ScheduledPostReviewToken | null> {
    if (!raw) return null;
    const lookup = tokenLookupPrefix(raw);
    if (!lookup) return null;
    const candidates = await ScheduledPostReviewTokenModel.find({
      token_lookup: lookup,
      used_at: { $exists: false },
      expires_at: { $gt: new Date() },
    }).limit(8); // Realistic upper bound on lookup-prefix collisions.
    for (const candidate of candidates) {
      if (verifyReviewToken(raw, candidate.token_hash)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Atomically mark a token as used. Returns null if the token was already
   * consumed (race-safe; defends against double-clicks on email links).
   */
  async consume(
    tokenId: string,
    action: ReviewTokenAction
  ): Promise<ScheduledPostReviewToken | null> {
    return ScheduledPostReviewTokenModel.findOneAndUpdate(
      { _id: tokenId, used_at: { $exists: false } },
      {
        $set: {
          used_at: new Date(),
          used_action: action,
          updated_at: new Date(),
        },
      },
      { new: true }
    );
  }

  /**
   * Invalidate all outstanding tokens for a scheduled post (e.g. when a new
   * rework round mints a fresh token). Marks them used with action `null`.
   */
  async invalidateForScheduledPost(siteId: string, scheduledPostId: string): Promise<number> {
    const result = await ScheduledPostReviewTokenModel.updateMany(
      {
        site_id: siteId,
        scheduled_post_id: scheduledPostId,
        used_at: { $exists: false },
      },
      {
        $set: {
          used_at: new Date(),
          updated_at: new Date(),
        },
      }
    );
    return result.modifiedCount ?? 0;
  }

  async findActiveForScheduledPost(
    siteId: string,
    scheduledPostId: string
  ): Promise<ScheduledPostReviewToken | null> {
    return ScheduledPostReviewTokenModel.findOne({
      site_id: siteId,
      scheduled_post_id: scheduledPostId,
      used_at: { $exists: false },
      expires_at: { $gt: new Date() },
    }).sort({ created_at: -1 });
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await ScheduledPostReviewTokenModel.deleteMany({ site_id: siteId });
  }
}
