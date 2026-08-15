import { injectable } from "tsyringe";
import { eq } from "drizzle-orm";
import { WaitlistEntry } from "../../../shared/schemas/waitlist.schema";
import { db } from "../../../shared/database";
import { waitlistEntries } from "../../../shared/database/schema";
import { omitUndefined, withId } from "../../../shared/database/map-row";

@injectable()
export class WaitlistRepository {
  private toEntity(row: typeof waitlistEntries.$inferSelect): WaitlistEntry {
    return withId(row) as unknown as WaitlistEntry;
  }

  async findByEmail(email: string): Promise<WaitlistEntry | null> {
    const [row] = await db
      .select()
      .from(waitlistEntries)
      .where(eq(waitlistEntries.email, email.toLowerCase().trim()))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async create(data: {
    email: string;
    first_name: string;
    last_name: string;
    source?: string;
  }): Promise<WaitlistEntry> {
    const [row] = await db
      .insert(waitlistEntries)
      .values({
        email: data.email.toLowerCase().trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        source: data.source ?? "landing_page",
        brevo_synced: false,
      })
      .returning();
    return this.toEntity(row);
  }

  async updateProfile(id: string, update: { first_name: string; last_name: string }): Promise<void> {
    await db
      .update(waitlistEntries)
      .set({
        first_name: update.first_name.trim(),
        last_name: update.last_name.trim(),
        updated_at: new Date(),
      })
      .where(eq(waitlistEntries.id, id));
  }

  async updateBrevoSync(
    id: string,
    update: {
      brevo_synced: boolean;
      brevo_contact_id?: number;
      brevo_sync_error?: string;
    }
  ): Promise<void> {
    await db
      .update(waitlistEntries)
      .set({ ...omitUndefined(update as Record<string, unknown>), updated_at: new Date() })
      .where(eq(waitlistEntries.id, id));
  }
}
