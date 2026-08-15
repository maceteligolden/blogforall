import { injectable } from "tsyringe";
import { asc, eq } from "drizzle-orm";
import { Plan } from "../../../shared/schemas/plan.schema";
import { db } from "../../../shared/database";
import { plans } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class PlanRepository {
  private toEntity(row: typeof plans.$inferSelect): Plan {
    return withId(row) as unknown as Plan;
  }

  async create(planData: Partial<Plan>): Promise<Plan> {
    const [row] = await db
      .insert(plans)
      .values({
        stripe_price_id: planData.stripe_price_id,
        name: planData.name!,
        price: planData.price ?? 0,
        currency: planData.currency ?? "usd",
        interval: planData.interval ?? "month",
        metadata: planData.metadata,
        limits: planData.limits ?? {},
        features: planData.features ?? [],
        isActive: planData.isActive ?? true,
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByName(name: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(eq(plans.name, name)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByStripePriceId(stripePriceId: string): Promise<Plan | null> {
    const [row] = await db.select().from(plans).where(eq(plans.stripe_price_id, stripePriceId)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async fetchActivePlans(): Promise<Plan[]> {
    const rows = await db.select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.price));
    return withIds(rows) as unknown as Plan[];
  }

  async findAll(): Promise<Plan[]> {
    const rows = await db.select().from(plans).orderBy(asc(plans.price));
    return withIds(rows) as unknown as Plan[];
  }

  async update(id: string, updateData: Partial<Plan>): Promise<Plan | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<Plan> & { id?: string };
    const [row] = await db
      .update(plans)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db.delete(plans).where(eq(plans.id, id)).returning({ id: plans.id });
    return rows.length > 0;
  }
}
