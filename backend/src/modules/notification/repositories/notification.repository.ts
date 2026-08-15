import { injectable } from "tsyringe";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { Notification } from "../../../shared/schemas/notification.schema";
import { PaginatedResponse } from "../../../shared/interfaces";
import { NotificationStatus } from "../../../shared/constants";
import { db } from "../../../shared/database";
import { notifications } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class NotificationRepository {
  private toEntity(row: typeof notifications.$inferSelect): Notification {
    return withId(row) as unknown as Notification;
  }

  /**
   * PSEUDOCODE:
   * 1. CREATE new document from notification
   * 2. SAVE to DB
   * 3. RETURN saved document
   */
  async save(notification: Partial<Notification>): Promise<Notification> {
    const { _id: _ignored, id: _idIgnored, ...rest } = notification as Partial<Notification> & { id?: string };
    const [row] = await db
      .insert(notifications)
      .values({
        channel: rest.channel!,
        type: rest.type!,
        status: rest.status!,
        correlation_id: rest.correlation_id!,
        ...omitUndefined({
          recipient_user_id: rest.recipient_user_id,
          recipient_email: rest.recipient_email,
          payload: rest.payload,
          read_at: rest.read_at,
          email_message_id: rest.email_message_id,
          template_key: rest.template_key,
          sent_at: rest.sent_at,
          failed_at: rest.failed_at,
          title: rest.title,
          body: rest.body,
        } as Record<string, unknown>),
      })
      .returning();
    return this.toEntity(row);
  }

  /**
   * PSEUDOCODE:
   * 1. FIND one document by _id
   * 2. RETURN lean document or null
   */
  async findById(id: string): Promise<Notification | null> {
    const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  /**
   * PSEUDOCODE:
   * 1. BUILD query: recipient_user_id = userId, channel = in_app, optional created_at >= since
   * 2. COMPUTE skip from page and limit (cap limit at 100)
   * 3. PARALLEL: FIND documents (sort by created_at desc, skip, limit) AND countDocuments
   * 4. RETURN { data, pagination: { page, limit, total, totalPages } }
   */
  async findByUserId(
    userId: string,
    options: { page?: number; limit?: number; since?: Date } = {}
  ): Promise<PaginatedResponse<Notification>> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [eq(notifications.recipient_user_id, userId), eq(notifications.channel, "in_app")];
    if (options.since) {
      conditions.push(gte(notifications.created_at, options.since));
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db.select().from(notifications).where(where).orderBy(desc(notifications.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(notifications)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: withIds(rows) as unknown as Notification[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * PSEUDOCODE:
   * 1. BUILD update object: status, updated_at, spread extra fields
   * 2. FIND by id AND UPDATE with new: true
   * 3. RETURN updated document or null
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    extra?: { email_message_id?: string; sent_at?: Date; failed_at?: Date; read_at?: Date }
  ): Promise<Notification | null> {
    const [row] = await db
      .update(notifications)
      .set({ status, updated_at: new Date(), ...omitUndefined((extra ?? {}) as Record<string, unknown>) })
      .where(eq(notifications.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  /**
   * PSEUDOCODE:
   * 1. FIND one where _id = id AND recipient_user_id = userId
   * 2. SET read_at = now, status = READ, updated_at = now
   * 3. RETURN updated document or null
   */
  async markRead(id: string, userId: string): Promise<Notification | null> {
    const now = new Date();
    const [row] = await db
      .update(notifications)
      .set({ read_at: now, status: NotificationStatus.READ, updated_at: now })
      .where(and(eq(notifications.id, id), eq(notifications.recipient_user_id, userId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  /**
   * PSEUDOCODE:
   * 1. UPDATE many where recipient_user_id = userId, channel = in_app, read_at is null
   * 2. SET read_at = now, status = READ, updated_at = now
   * 3. RETURN modifiedCount
   */
  async markAllRead(userId: string): Promise<number> {
    const now = new Date();
    const rows = await db
      .update(notifications)
      .set({ read_at: now, status: NotificationStatus.READ, updated_at: now })
      .where(
        and(
          eq(notifications.recipient_user_id, userId),
          eq(notifications.channel, "in_app"),
          isNull(notifications.read_at)
        )
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  /**
   * PSEUDOCODE:
   * 1. COUNT documents where recipient_user_id = userId, channel = in_app, read_at is null
   * 2. RETURN count
   */
  async countUnreadByUserId(userId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipient_user_id, userId),
          eq(notifications.channel, "in_app"),
          isNull(notifications.read_at)
        )
      );
    return Number(row?.value ?? 0);
  }
}
