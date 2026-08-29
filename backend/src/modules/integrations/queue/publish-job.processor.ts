import { injectable } from "tsyringe";
import type { Job } from "bull";
import { logger } from "../../../shared/utils/logger";
import { CONNECTION_STATUS, DELIVERY_STATUS, INTEGRATION_PROVIDERS } from "../constants";
import { decryptWorkspaceApiKeySecret } from "../../../shared/utils/workspace-api-key-crypto";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { IntegrationConnectionRepository } from "../repositories/connection.repository";
import { IntegrationDeliveryRepository } from "../repositories/delivery.repository";
import { FramerProvider } from "../providers/framer.provider";
import type { IntegrationPublishJob } from "./publish.queue";
import type { FramerMappableField } from "../constants";
import { deriveFramerPublishValues } from "../services/framer-publish-payload";

@injectable()
export class IntegrationPublishProcessor {
  constructor(
    private deliveries: IntegrationDeliveryRepository,
    private connections: IntegrationConnectionRepository,
    private blogs: BlogRepository,
    private framer: FramerProvider
  ) {}

  async handle(job: Pick<Job<IntegrationPublishJob>, "data" | "id">): Promise<void> {
    const { deliveryId, siteId } = job.data;
    const claimed = await this.deliveries.claimForPublish(deliveryId, String(job.id ?? "inline"));
    if (!claimed) {
      logger.info("Framer publish skipped — delivery not claimable", { deliveryId }, "IntegrationPublishProcessor");
      return;
    }
    if (claimed.status === DELIVERY_STATUS.PUBLISHED && claimed.external_item_id) {
      return;
    }
    const connection = await this.connections.findBySiteAndProvider(siteId, INTEGRATION_PROVIDERS.FRAMER);
    if (!connection || connection.status !== CONNECTION_STATUS.CONNECTED || !connection.credentials_encrypted) {
      await this.deliveries.markFailed(deliveryId, "Framer is disconnected");
      return;
    }
    const blog = await this.blogs.findById(claimed.blog_id, siteId);
    if (!blog) {
      await this.deliveries.markFailed(deliveryId, "Blog not found");
      return;
    }
    try {
      const result = await this.framer.publishItem(
        connection.config.projectUrl ?? "",
        decryptWorkspaceApiKeySecret(connection.credentials_encrypted),
        connection.config.collectionId ?? "",
        {
          ...deriveFramerPublishValues(blog),
          fieldMap: (connection.config.fieldMap ?? {}) as Partial<Record<FramerMappableField, string>>,
          existingItemId: claimed.external_item_id ?? undefined,
        },
        connection.config.autoDeploy !== false
      );
      await this.deliveries.markPublished(deliveryId, {
        externalItemId: result.itemId,
        externalUrl: result.url,
        deploymentId: result.deploymentId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Framer publish failed";
      await this.deliveries.markFailed(deliveryId, message);
      throw error;
    }
  }
}
