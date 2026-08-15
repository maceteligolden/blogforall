import { injectable } from "tsyringe";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Subscription, SubscriptionStatus } from "../../../shared/schemas/subscription.schema";
import { db, withTransaction } from "../../../shared/database";
import { subscriptions, users } from "../../../shared/database/schema";
import { omitUndefined, withId } from "../../../shared/database/map-row";

@injectable()
export class SubscriptionRepository {
  private toEntity(row: typeof subscriptions.$inferSelect): Subscription {
    return withId(row) as unknown as Subscription;
  }

  async create(subscriptionData: Partial<Subscription>): Promise<Subscription> {
    const [row] = await db
      .insert(subscriptions)
      .values({
        userId: subscriptionData.userId!,
        planId: subscriptionData.planId!,
        pendingPlanId: subscriptionData.pendingPlanId,
        status: subscriptionData.status ?? SubscriptionStatus.FREE,
        currentPeriodStart: subscriptionData.currentPeriodStart!,
        currentPeriodEnd: subscriptionData.currentPeriodEnd!,
        gracePeriodEndsAt: subscriptionData.gracePeriodEndsAt,
        paymentProvider: subscriptionData.paymentProvider,
        providerSubscriptionId: subscriptionData.providerSubscriptionId,
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd ?? false,
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string): Promise<Subscription | null> {
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.created_at))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.FREE,
          ])
        )
      )
      .orderBy(desc(subscriptions.created_at))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByProviderSubscriptionId(providerSubscriptionId: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async update(id: string, updateData: Partial<Subscription>): Promise<Subscription | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<Subscription> & { id?: string };
    const [row] = await db
      .update(subscriptions)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async updateWithUserPlan(
    id: string,
    updateData: Partial<Subscription>,
    userPlan?: { userId: string; plan: string }
  ): Promise<Subscription | null> {
    return withTransaction(async (tx) => {
      const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<Subscription> & { id?: string };
      const [row] = await tx
        .update(subscriptions)
        .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
        .where(eq(subscriptions.id, id))
        .returning();
      if (userPlan) {
        await tx
          .update(users)
          .set({ plan: userPlan.plan, updated_at: new Date() })
          .where(eq(users.id, userPlan.userId));
      }
      return row ? this.toEntity(row) : null;
    });
  }

  async updateByUserId(userId: string, updateData: Partial<Subscription>): Promise<Subscription | null> {
    const existing = await this.findByUserId(userId);
    if (!existing?._id) return null;
    return this.update(existing._id, updateData);
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db.delete(subscriptions).where(eq(subscriptions.id, id)).returning({ id: subscriptions.id });
    return rows.length > 0;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  }
}
