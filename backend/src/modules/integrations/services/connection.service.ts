import { injectable } from "tsyringe";
import { pool } from "../../../shared/database";
import { BadRequestError, NotFoundError } from "../../../shared/errors";
import {
  encryptWorkspaceApiKeySecret,
  decryptWorkspaceApiKeySecret,
} from "../../../shared/utils/workspace-api-key-crypto";
import { assertSiteCapability, SiteCapability } from "../../../shared/utils/site-permissions.util";
import { SiteService } from "../../site/services/site.service";
import { INTEGRATION_CATALOG } from "../catalog";
import { CONNECTION_STATUS, INTEGRATION_CATALOG_STATUS, INTEGRATION_PROVIDERS } from "../constants";
import { maskSecret, syncIdempotencyKey } from "../idempotency";
import { IntegrationConnectionRepository, type IntegrationConnectionRow } from "../repositories/connection.repository";
import { IntegrationDeliveryRepository } from "../repositories/delivery.repository";
import { FramerProvider } from "../providers/framer.provider";
import { normalizeFramerProjectTarget } from "../providers/framer-project-url";
import { integrationPublishQueue } from "../queue/publish.queue";
import type { FramerMappableField } from "../constants";

@injectable()
export class IntegrationConnectionService {
  constructor(
    private connections: IntegrationConnectionRepository,
    private deliveries: IntegrationDeliveryRepository,
    private framer: FramerProvider,
    private siteService: SiteService
  ) {}

  private async assertManage(siteId: string, userId: string): Promise<void> {
    const role = await this.siteService.getUserRole(siteId, userId);
    assertSiteCapability(role, SiteCapability.MANAGE_WORKSPACE);
  }

  async listCatalog(siteId: string, userId: string) {
    await this.assertManage(siteId, userId);
    const rows = await this.connections.listBySite(siteId);
    const byProvider = new Map(rows.map((row) => [row.provider, row]));
    return INTEGRATION_CATALOG.map((entry) => {
      const connection = byProvider.get(entry.provider);
      const connected = connection?.status === CONNECTION_STATUS.CONNECTED;
      return {
        ...entry,
        connectionStatus: connection?.status ?? CONNECTION_STATUS.DISCONNECTED,
        connected,
        action:
          entry.catalogStatus === INTEGRATION_CATALOG_STATUS.COMING_SOON
            ? "coming_soon"
            : connected
              ? "manage"
              : "configure",
      };
    });
  }

  private async assertWrite(siteId: string, userId: string): Promise<void> {
    const role = await this.siteService.getUserRole(siteId, userId);
    assertSiteCapability(role, SiteCapability.WRITE_CONTENT);
  }

  async listPublishDestinations(siteId: string, userId: string) {
    await this.assertWrite(siteId, userId);
    const cms = await this.listConnectedCms(siteId);
    return [{ provider: INTEGRATION_PROVIDERS.BLOGGR, label: "Bloggr" }, ...cms];
  }

  async listConnectedCms(siteId: string): Promise<Array<{ provider: string; label: string }>> {
    const rows = await this.connections.listConnectedBySite(siteId);
    return rows
      .filter((row) => row.provider === INTEGRATION_PROVIDERS.FRAMER)
      .map((row) => ({
        provider: row.provider,
        label: INTEGRATION_CATALOG.find((entry) => entry.provider === row.provider)?.label ?? row.provider,
      }));
  }

  async testFramer(siteId: string, userId: string, input: { projectUrl: string; apiKey: string }) {
    await this.assertManage(siteId, userId);
    try {
      const projectUrl = normalizeFramerProjectTarget(input.projectUrl);
      return await this.framer.testConnection(projectUrl, input.apiKey.trim());
    } catch (error) {
      throw new BadRequestError(error instanceof Error ? error.message : "Could not connect to Framer");
    }
  }

  async saveFramer(
    siteId: string,
    userId: string,
    input: {
      projectUrl: string;
      apiKey: string;
      collectionId: string;
      collectionName: string;
      fieldMap: Partial<Record<FramerMappableField, string>>;
      autoDeploy?: boolean;
    }
  ) {
    await this.assertManage(siteId, userId);
    const projectUrl = normalizeFramerProjectTarget(input.projectUrl);
    const tested = await this.testFramer(siteId, userId, { ...input, projectUrl });
    const collection = tested.collections.find((item) => item.id === input.collectionId);
    if (!collection) {
      throw new BadRequestError("Selected Framer collection was not found");
    }
    const fieldIds = new Set(collection.fields.map((field) => field.id));
    for (const fieldId of Object.values(input.fieldMap)) {
      if (fieldId && !fieldIds.has(fieldId)) {
        throw new BadRequestError("Field map includes a Framer field that does not exist on the collection");
      }
    }
    const connection = await this.connections.upsertConnection({
      siteId,
      provider: INTEGRATION_PROVIDERS.FRAMER,
      status: CONNECTION_STATUS.CONNECTED,
      credentialsEncrypted: encryptWorkspaceApiKeySecret(input.apiKey.trim()),
      config: {
        projectUrl,
        collectionId: input.collectionId,
        collectionName: input.collectionName,
        fieldMap: input.fieldMap as Record<string, string>,
        autoDeploy: input.autoDeploy !== false,
      },
      connectedBy: userId,
      lastVerifiedAt: new Date(),
      lastError: null,
    });
    return this.publicConnection(connection, input.apiKey.trim());
  }

  async getFramer(siteId: string, userId: string) {
    await this.assertManage(siteId, userId);
    const connection = await this.connections.findBySiteAndProvider(siteId, INTEGRATION_PROVIDERS.FRAMER);
    if (!connection || connection.status !== CONNECTION_STATUS.CONNECTED) {
      throw new NotFoundError("Framer is not connected");
    }
    const [deliveries, metrics] = await Promise.all([
      this.deliveries.listByConnection(siteId, connection.id),
      this.deliveries.metrics(siteId, connection.id),
    ]);
    return {
      connection: this.publicConnection(connection),
      deliveries,
      metrics,
    };
  }

  async syncFramer(siteId: string, userId: string) {
    await this.assertManage(siteId, userId);
    const connection = await this.requireConnectedFramer(siteId);
    const lockKey = syncIdempotencyKey(INTEGRATION_PROVIDERS.FRAMER, siteId, connection.id);
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockKey]);
      const apiKey = this.decrypt(connection.credentials_encrypted);
      const items = await this.framer.listItems(
        connection.config.projectUrl ?? "",
        apiKey,
        connection.config.collectionId ?? ""
      );
      const byId = new Map(items.map((item) => [item.id, item]));
      const deliveries = await this.deliveries.listByConnection(siteId, connection.id);
      const now = new Date();
      for (const delivery of deliveries) {
        if (!delivery.external_item_id) {
          await this.deliveries.applySync(delivery.id, { lastSyncedAt: now });
          continue;
        }
        const remote = byId.get(delivery.external_item_id);
        await this.deliveries.applySync(delivery.id, {
          lastSyncedAt: now,
          externalUrl: remote?.slug
            ? (delivery.external_url?.replace(/\/[^/]*$/, `/${remote.slug}`) ?? delivery.external_url)
            : delivery.external_url,
        });
      }
      return this.getFramer(siteId, userId);
    } finally {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockKey]);
      } finally {
        client.release();
      }
    }
  }

  async disconnectFramer(siteId: string, userId: string): Promise<void> {
    await this.assertManage(siteId, userId);
    const existing = await this.connections.findBySiteAndProvider(siteId, INTEGRATION_PROVIDERS.FRAMER);
    if (!existing) return;
    const jobIds = await this.deliveries.cancelInFlight(existing.id);
    await this.connections.disconnect(siteId, INTEGRATION_PROVIDERS.FRAMER);
    await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await integrationPublishQueue.getJob(jobId);
        if (job) await job.remove();
      })
    );
  }

  async requireConnectedFramer(siteId: string) {
    const connection = await this.connections.findBySiteAndProvider(siteId, INTEGRATION_PROVIDERS.FRAMER);
    if (!connection || connection.status !== CONNECTION_STATUS.CONNECTED || !connection.credentials_encrypted) {
      throw new NotFoundError("Framer is not connected");
    }
    return connection;
  }

  decrypt(payload: string | null): string {
    if (!payload) throw new BadRequestError("Framer API key is missing. Reconnect the integration.");
    return decryptWorkspaceApiKeySecret(payload);
  }

  private publicConnection(connection: IntegrationConnectionRow, plainKey?: string) {
    let masked: string | null = null;
    try {
      masked = maskSecret(
        plainKey ?? (connection.credentials_encrypted ? this.decrypt(connection.credentials_encrypted) : null)
      );
    } catch {
      masked = "••••";
    }
    return {
      id: connection.id,
      provider: connection.provider,
      status: connection.status,
      config: {
        projectUrl: connection.config.projectUrl,
        collectionId: connection.config.collectionId,
        collectionName: connection.config.collectionName,
        fieldMap: connection.config.fieldMap ?? {},
        autoDeploy: connection.config.autoDeploy !== false,
      },
      maskedApiKey: masked,
      lastVerifiedAt: connection.last_verified_at,
      lastError: connection.last_error,
      connectedAt: connection.updated_at,
    };
  }
}
