import { injectable } from "tsyringe";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, withTransaction, type AppTransaction, type DbOrTx } from "../../../shared/database";
import { integrationDeliveries } from "../../../shared/database/schema";
import { withId } from "../../../shared/database/map-row";
import { DELIVERY_STATUS, type DeliveryStatus } from "../constants";

export type IntegrationDeliveryRow = typeof integrationDeliveries.$inferSelect & { _id: string };

@injectable()
export class IntegrationDeliveryRepository {
  private toEntity(row: typeof integrationDeliveries.$inferSelect): IntegrationDeliveryRow {
    return withId(row);
  }

  async findById(id: string, tx: DbOrTx = db): Promise<IntegrationDeliveryRow | null> {
    const [row] = await tx.select().from(integrationDeliveries).where(eq(integrationDeliveries.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByIdempotencyKey(key: string, tx: DbOrTx = db): Promise<IntegrationDeliveryRow | null> {
    const [row] = await tx
      .select()
      .from(integrationDeliveries)
      .where(eq(integrationDeliveries.idempotency_key, key))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async listByConnection(siteId: string, connectionId: string): Promise<IntegrationDeliveryRow[]> {
    const rows = await db
      .select()
      .from(integrationDeliveries)
      .where(and(eq(integrationDeliveries.site_id, siteId), eq(integrationDeliveries.connection_id, connectionId)))
      .orderBy(desc(integrationDeliveries.updated_at));
    return rows.map((row) => this.toEntity(row));
  }

  async upsertPending(
    input: {
      siteId: string;
      connectionId: string;
      blogId: string;
      provider: string;
      idempotencyKey: string;
      clientRequestId?: string;
    },
    tx: AppTransaction
  ): Promise<IntegrationDeliveryRow> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.idempotencyKey}))`);
    const [row] = await tx
      .insert(integrationDeliveries)
      .values({
        site_id: input.siteId,
        connection_id: input.connectionId,
        blog_id: input.blogId,
        provider: input.provider,
        status: DELIVERY_STATUS.PENDING,
        idempotency_key: input.idempotencyKey,
        client_request_id: input.clientRequestId,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: integrationDeliveries.idempotency_key,
        set: {
          status: sql`CASE WHEN ${integrationDeliveries.status} = ${DELIVERY_STATUS.PUBLISHING} THEN ${integrationDeliveries.status} ELSE ${DELIVERY_STATUS.PENDING} END`,
          last_error: null,
          client_request_id: input.clientRequestId,
          updated_at: new Date(),
        },
      })
      .returning();
    return this.toEntity(row);
  }

  async claimForPublish(deliveryId: string, lockedBy: string): Promise<IntegrationDeliveryRow | null> {
    return withTransaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(integrationDeliveries)
        .where(eq(integrationDeliveries.id, deliveryId))
        .for("update")
        .limit(1);
      if (!existing) return null;
      if (existing.status === DELIVERY_STATUS.PUBLISHED) {
        return this.toEntity(existing);
      }
      if (
        existing.status !== DELIVERY_STATUS.PENDING &&
        existing.status !== DELIVERY_STATUS.FAILED &&
        existing.status !== DELIVERY_STATUS.PUBLISHING
      ) {
        return null;
      }
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${existing.idempotency_key}))`);
      const [row] = await tx
        .update(integrationDeliveries)
        .set({
          status: DELIVERY_STATUS.PUBLISHING,
          locked_at: new Date(),
          locked_by: lockedBy,
          attempts: sql`${integrationDeliveries.attempts} + 1`,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(integrationDeliveries.id, deliveryId),
            inArray(integrationDeliveries.status, [
              DELIVERY_STATUS.PENDING,
              DELIVERY_STATUS.FAILED,
              DELIVERY_STATUS.PUBLISHING,
            ])
          )
        )
        .returning();
      return row ? this.toEntity(row) : null;
    });
  }

  async markPublished(
    deliveryId: string,
    result: { externalItemId?: string; externalUrl?: string; deploymentId?: string }
  ): Promise<void> {
    await db
      .update(integrationDeliveries)
      .set({
        status: DELIVERY_STATUS.PUBLISHED,
        external_item_id: result.externalItemId,
        external_url: result.externalUrl,
        deployment_id: result.deploymentId,
        last_error: null,
        last_synced_at: new Date(),
        published_at: new Date(),
        locked_at: null,
        locked_by: null,
        updated_at: new Date(),
      })
      .where(eq(integrationDeliveries.id, deliveryId));
  }

  async markFailed(deliveryId: string, error: string): Promise<void> {
    await db
      .update(integrationDeliveries)
      .set({
        status: DELIVERY_STATUS.FAILED,
        last_error: error.slice(0, 2000),
        locked_at: null,
        locked_by: null,
        updated_at: new Date(),
      })
      .where(eq(integrationDeliveries.id, deliveryId));
  }

  async cancelInFlight(connectionId: string): Promise<string[]> {
    return withTransaction(async (tx) => {
      const rows = await tx
        .update(integrationDeliveries)
        .set({
          status: DELIVERY_STATUS.CANCELLED,
          last_error: "Connection disconnected",
          locked_at: null,
          locked_by: null,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(integrationDeliveries.connection_id, connectionId),
            inArray(integrationDeliveries.status, [
              DELIVERY_STATUS.PENDING,
              DELIVERY_STATUS.PUBLISHING,
              DELIVERY_STATUS.FAILED,
            ])
          )
        )
        .returning({ key: integrationDeliveries.idempotency_key });
      return rows.map((row) => row.key);
    });
  }

  async metrics(
    siteId: string,
    connectionId: string
  ): Promise<{
    published: number;
    failed: number;
    pending: number;
    lastPublishedAt: Date | null;
    lastSyncedAt: Date | null;
  }> {
    const [row] = await db
      .select({
        published: sql<number>`count(*) filter (where ${integrationDeliveries.status} = ${DELIVERY_STATUS.PUBLISHED})`,
        failed: sql<number>`count(*) filter (where ${integrationDeliveries.status} = ${DELIVERY_STATUS.FAILED})`,
        pending: sql<number>`count(*) filter (where ${integrationDeliveries.status} in (${DELIVERY_STATUS.PENDING}, ${DELIVERY_STATUS.PUBLISHING}))`,
        lastPublishedAt: sql<Date | null>`max(${integrationDeliveries.published_at})`,
        lastSyncedAt: sql<Date | null>`max(${integrationDeliveries.last_synced_at})`,
      })
      .from(integrationDeliveries)
      .where(and(eq(integrationDeliveries.site_id, siteId), eq(integrationDeliveries.connection_id, connectionId)));
    return {
      published: Number(row?.published ?? 0),
      failed: Number(row?.failed ?? 0),
      pending: Number(row?.pending ?? 0),
      lastPublishedAt: row?.lastPublishedAt ?? null,
      lastSyncedAt: row?.lastSyncedAt ?? null,
    };
  }

  async applySync(
    deliveryId: string,
    patch: { externalUrl?: string | null; lastSyncedAt: Date; status?: DeliveryStatus }
  ): Promise<void> {
    await db
      .update(integrationDeliveries)
      .set({
        ...(patch.externalUrl !== undefined ? { external_url: patch.externalUrl } : {}),
        ...(patch.status ? { status: patch.status } : {}),
        last_synced_at: patch.lastSyncedAt,
        updated_at: new Date(),
      })
      .where(eq(integrationDeliveries.id, deliveryId));
  }
}
