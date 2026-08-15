import { injectable } from "tsyringe";
import { and, desc, eq } from "drizzle-orm";
import { Card } from "../../../shared/schemas/card.schema";
import { db } from "../../../shared/database";
import { cards } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class CardRepository {
  private toEntity(row: typeof cards.$inferSelect): Card {
    return withId(row) as unknown as Card;
  }

  async create(cardData: Partial<Card>): Promise<Card> {
    const [row] = await db
      .insert(cards)
      .values({
        stripe_card_token: cardData.stripe_card_token!,
        last_digits: cardData.last_digits!,
        expire_date: cardData.expire_date!,
        type: cardData.type!,
        stripe_customer_id: cardData.stripe_customer_id!,
        is_default: cardData.is_default ?? false,
      })
      .returning();
    return this.toEntity(row);
  }

  async findById(id: string): Promise<Card | null> {
    const [row] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByStripeToken(stripeCardToken: string): Promise<Card | null> {
    const [row] = await db.select().from(cards).where(eq(cards.stripe_card_token, stripeCardToken)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByCustomerId(stripeCustomerId: string): Promise<Card[]> {
    const rows = await db
      .select()
      .from(cards)
      .where(eq(cards.stripe_customer_id, stripeCustomerId))
      .orderBy(desc(cards.is_default), desc(cards.created_at));
    return withIds(rows) as unknown as Card[];
  }

  async findDefaultCard(stripeCustomerId: string): Promise<Card | null> {
    const [row] = await db
      .select()
      .from(cards)
      .where(and(eq(cards.stripe_customer_id, stripeCustomerId), eq(cards.is_default, true)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async update(id: string, updateData: Partial<Card>): Promise<Card | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<Card> & { id?: string };
    const [row] = await db
      .update(cards)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(cards.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async setAllCardsNonDefault(stripeCustomerId: string): Promise<void> {
    await db
      .update(cards)
      .set({ is_default: false, updated_at: new Date() })
      .where(eq(cards.stripe_customer_id, stripeCustomerId));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await db.delete(cards).where(eq(cards.id, id)).returning({ id: cards.id });
    return rows.length > 0;
  }
}
