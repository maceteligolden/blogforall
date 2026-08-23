import { injectable } from "tsyringe";
import { and, eq, sql } from "drizzle-orm";
import { db, withTransaction, type AppTransaction, type DbOrTx } from "../../../shared/database";
import { integrationConnections, type IntegrationConnectionConfig } from "../../../shared/database/schema";
import { withId } from "../../../shared/database/map-row";
import { CONNECTION_STATUS, type ConnectionStatus } from "../constants";

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect & { _id: string };

@injectable()
export class IntegrationConnectionRepository {
  private toEntity(row: typeof integrationConnections.$inferSelect): IntegrationConnectionRow {
    return withId(row);
  }

  async findBySiteAndProvider(
    siteId: string,
    provider: string,
    tx: DbOrTx = db
  ): Promise<IntegrationConnectionRow | null> {
    const [row] = await tx
      .select()
      .from(integrationConnections)
      .where(and(eq(integrationConnections.site_id, siteId), eq(integrationConnections.provider, provider)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async lockBySiteAndProvider(
    siteId: string,
    provider: string,
    tx: AppTransaction
  ): Promise<IntegrationConnectionRow | null> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${provider}:connect:${siteId}`}))`);
    const [row] = await tx
      .select()
      .from(integrationConnections)
      .where(and(eq(integrationConnections.site_id, siteId), eq(integrationConnections.provider, provider)))
      .for("update")
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async listBySite(siteId: string): Promise<IntegrationConnectionRow[]> {
    const rows = await db.select().from(integrationConnections).where(eq(integrationConnections.site_id, siteId));
    return rows.map((row) => this.toEntity(row));
  }

  async listConnectedBySite(siteId: string): Promise<IntegrationConnectionRow[]> {
    const rows = await db
      .select()
      .from(integrationConnections)
      .where(
        and(eq(integrationConnections.site_id, siteId), eq(integrationConnections.status, CONNECTION_STATUS.CONNECTED))
      );
    return rows.map((row) => this.toEntity(row));
  }

  async upsertConnection(input: {
    siteId: string;
    provider: string;
    status: ConnectionStatus;
    credentialsEncrypted: string | null;
    config: IntegrationConnectionConfig;
    connectedBy: string;
    lastVerifiedAt: Date | null;
    lastError: string | null;
  }): Promise<IntegrationConnectionRow> {
    return withTransaction(async (tx) => {
      await this.lockBySiteAndProvider(input.siteId, input.provider, tx);
      const [row] = await tx
        .insert(integrationConnections)
        .values({
          site_id: input.siteId,
          provider: input.provider,
          status: input.status,
          credentials_encrypted: input.credentialsEncrypted,
          config: input.config,
          connected_by: input.connectedBy,
          last_verified_at: input.lastVerifiedAt,
          last_error: input.lastError,
          updated_at: new Date(),
        })
        .onConflictDoUpdate({
          target: [integrationConnections.site_id, integrationConnections.provider],
          set: {
            status: input.status,
            credentials_encrypted: input.credentialsEncrypted,
            config: input.config,
            connected_by: input.connectedBy,
            last_verified_at: input.lastVerifiedAt,
            last_error: input.lastError,
            updated_at: new Date(),
          },
        })
        .returning();
      return this.toEntity(row);
    });
  }

  async disconnect(siteId: string, provider: string): Promise<IntegrationConnectionRow | null> {
    return withTransaction(async (tx) => {
      const existing = await this.lockBySiteAndProvider(siteId, provider, tx);
      if (!existing) return null;
      const [row] = await tx
        .update(integrationConnections)
        .set({
          status: CONNECTION_STATUS.DISCONNECTED,
          credentials_encrypted: null,
          last_error: null,
          updated_at: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id))
        .returning();
      return row ? this.toEntity(row) : existing;
    });
  }

  async markError(connectionId: string, error: string): Promise<void> {
    await db
      .update(integrationConnections)
      .set({ status: CONNECTION_STATUS.ERROR, last_error: error, updated_at: new Date() })
      .where(eq(integrationConnections.id, connectionId));
  }
}
