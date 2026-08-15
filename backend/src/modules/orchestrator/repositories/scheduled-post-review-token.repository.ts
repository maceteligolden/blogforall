import { injectable } from "tsyringe";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  ReviewTokenAction,
  ScheduledPostReviewToken,
} from "../../../shared/schemas/scheduled-post-review-token.schema";
import { mintReviewToken, tokenLookupPrefix, verifyReviewToken } from "../utils/review-token";
import { db } from "../../../shared/database";
import { scheduledPostReviewTokens } from "../../../shared/database/schema";
import { withId } from "../../../shared/database/map-row";

@injectable()
export class ScheduledPostReviewTokenRepository {
  private toEntity(row: typeof scheduledPostReviewTokens.$inferSelect): ScheduledPostReviewToken {
    return withId(row) as unknown as ScheduledPostReviewToken;
  }

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
    const [row] = await db
      .insert(scheduledPostReviewTokens)
      .values({
        site_id: input.site_id,
        scheduled_post_id: input.scheduled_post_id,
        user_id: input.user_id,
        token_lookup: lookup,
        token_hash: hash,
        expires_at: input.expires_at,
        rework_round: input.rework_round,
      })
      .returning();
    return { token: this.toEntity(row), raw };
  }

  /**
   * Find a valid (unused, non-expired) token by its raw value. Returns null
   * on any mismatch or expiry. Constant-time hash compare for the candidate.
   */
  async findValid(raw: string): Promise<ScheduledPostReviewToken | null> {
    if (!raw) return null;
    const lookup = tokenLookupPrefix(raw);
    if (!lookup) return null;
    const candidates = await db
      .select()
      .from(scheduledPostReviewTokens)
      .where(
        and(
          eq(scheduledPostReviewTokens.token_lookup, lookup),
          isNull(scheduledPostReviewTokens.used_at),
          gt(scheduledPostReviewTokens.expires_at, new Date())
        )
      )
      .limit(8);
    for (const candidate of candidates) {
      if (verifyReviewToken(raw, candidate.token_hash)) {
        return this.toEntity(candidate);
      }
    }
    return null;
  }

  /**
   * Atomically mark a token as used. Returns null if the token was already
   * consumed (race-safe; defends against double-clicks on email links).
   */
  async consume(tokenId: string, action: ReviewTokenAction): Promise<ScheduledPostReviewToken | null> {
    const [row] = await db
      .update(scheduledPostReviewTokens)
      .set({
        used_at: new Date(),
        used_action: action,
        updated_at: new Date(),
      })
      .where(and(eq(scheduledPostReviewTokens.id, tokenId), isNull(scheduledPostReviewTokens.used_at)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  /**
   * Invalidate all outstanding tokens for a scheduled post (e.g. when a new
   * rework round mints a fresh token). Marks them used with action `null`.
   */
  async invalidateForScheduledPost(siteId: string, scheduledPostId: string): Promise<number> {
    const rows = await db
      .update(scheduledPostReviewTokens)
      .set({
        used_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(scheduledPostReviewTokens.site_id, siteId),
          eq(scheduledPostReviewTokens.scheduled_post_id, scheduledPostId),
          isNull(scheduledPostReviewTokens.used_at)
        )
      )
      .returning({ id: scheduledPostReviewTokens.id });
    return rows.length;
  }

  async findActiveForScheduledPost(siteId: string, scheduledPostId: string): Promise<ScheduledPostReviewToken | null> {
    const [row] = await db
      .select()
      .from(scheduledPostReviewTokens)
      .where(
        and(
          eq(scheduledPostReviewTokens.site_id, siteId),
          eq(scheduledPostReviewTokens.scheduled_post_id, scheduledPostId),
          isNull(scheduledPostReviewTokens.used_at),
          gt(scheduledPostReviewTokens.expires_at, new Date())
        )
      )
      .orderBy(desc(scheduledPostReviewTokens.created_at))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await db.delete(scheduledPostReviewTokens).where(eq(scheduledPostReviewTokens.site_id, siteId));
  }
}
