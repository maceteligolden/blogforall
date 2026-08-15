import { injectable } from "tsyringe";
import { desc, eq, sql } from "drizzle-orm";
import { Referral, ReferralStatus } from "../../../shared/schemas/referral.schema";
import { db } from "../../../shared/database";
import { referrals } from "../../../shared/database/schema";
import { withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class ReferralRepository {
  private toEntity(row: typeof referrals.$inferSelect): Referral {
    return withId(row) as unknown as Referral;
  }

  async create(data: {
    referrer_user_id: string;
    referred_user_id: string;
    status?: ReferralStatus;
  }): Promise<Referral> {
    const [row] = await db
      .insert(referrals)
      .values({
        referrer_user_id: data.referrer_user_id,
        referred_user_id: data.referred_user_id,
        status: data.status ?? ReferralStatus.SIGNED_UP,
      })
      .returning();
    return this.toEntity(row);
  }

  async findByReferredUserId(referredUserId: string): Promise<Referral | null> {
    const [row] = await db.select().from(referrals).where(eq(referrals.referred_user_id, referredUserId)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async listByReferrerUserId(referrerUserId: string): Promise<Referral[]> {
    const rows = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrer_user_id, referrerUserId))
      .orderBy(desc(referrals.created_at));
    return withIds(rows) as unknown as Referral[];
  }

  async countByReferrerUserId(referrerUserId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(referrals)
      .where(eq(referrals.referrer_user_id, referrerUserId));
    return Number(row?.value ?? 0);
  }
}
