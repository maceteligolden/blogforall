import { injectable } from "tsyringe";
import { withTransaction } from "../../../shared/database";
import { blogs } from "../../../shared/database/schema";
import { and, eq } from "drizzle-orm";
import { BadRequestError, NotFoundError } from "../../../shared/errors";
import { BlogService } from "../../blog/services/blog.service";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { CONNECTION_STATUS, DELIVERY_STATUS, INTEGRATION_PROVIDERS, type PublishDestination } from "../constants";
import { normalizeDestinations, publishIdempotencyKey } from "../idempotency";
import { IntegrationConnectionRepository } from "../repositories/connection.repository";
import { IntegrationDeliveryRepository } from "../repositories/delivery.repository";
import { integrationPublishQueue, isIntegrationPublishQueueConnected } from "../queue/publish.queue";
import { logger } from "../../../shared/utils/logger";
import type { Blog } from "../../../shared/schemas/blog.schema";
import { IntegrationPublishProcessor } from "../queue/publish-job.processor";

@injectable()
export class PublishRouterService {
  constructor(
    private blogService: BlogService,
    private blogRepository: BlogRepository,
    private connections: IntegrationConnectionRepository,
    private deliveries: IntegrationDeliveryRepository,
    private processor: IntegrationPublishProcessor
  ) {}

  async publish(input: {
    blogId: string;
    siteId: string;
    userId: string;
    destinations?: string[];
    clientRequestId?: string;
  }): Promise<{
    blog: Blog;
    destinations: PublishDestination[];
    deliveries: Array<{ provider: string; status: string }>;
  }> {
    const requested = normalizeDestinations(input.destinations);
    const connected = await this.connections.listConnectedBySite(input.siteId);
    const framer = connected.find(
      (row) => row.provider === INTEGRATION_PROVIDERS.FRAMER && row.status === CONNECTION_STATUS.CONNECTED
    );
    const destinations = requested.filter(
      (dest) => dest === INTEGRATION_PROVIDERS.BLOGGR || (dest === INTEGRATION_PROVIDERS.FRAMER && framer)
    );
    if (!destinations.length) {
      throw new BadRequestError("Select at least one connected publishing destination");
    }

    const deliveryIds: string[] = [];
    await withTransaction(async (tx) => {
      const [locked] = await tx
        .select({ id: blogs.id, status: blogs.status })
        .from(blogs)
        .where(and(eq(blogs.id, input.blogId), eq(blogs.site_id, input.siteId)))
        .for("update")
        .limit(1);
      if (!locked) {
        throw new NotFoundError("Blog not found");
      }
      if (framer && destinations.includes(INTEGRATION_PROVIDERS.FRAMER)) {
        const delivery = await this.deliveries.upsertPending(
          {
            siteId: input.siteId,
            connectionId: framer.id,
            blogId: input.blogId,
            provider: INTEGRATION_PROVIDERS.FRAMER,
            idempotencyKey: publishIdempotencyKey(INTEGRATION_PROVIDERS.FRAMER, input.siteId, input.blogId, framer.id),
            clientRequestId: input.clientRequestId,
          },
          tx
        );
        if (delivery.status !== DELIVERY_STATUS.PUBLISHED) {
          deliveryIds.push(delivery.id);
        }
      }
    });

    let blog: Blog | null = null;
    if (destinations.includes(INTEGRATION_PROVIDERS.BLOGGR)) {
      blog = await this.blogService.publishBlog(input.blogId, input.siteId, input.userId);
    } else {
      blog = await this.blogRepository.findById(input.blogId, input.siteId);
    }
    if (!blog) {
      throw new NotFoundError("Blog not found");
    }

    for (const deliveryId of [...new Set(deliveryIds)]) {
      await this.enqueueOrRun({ deliveryId, siteId: input.siteId, connectionId: framer?.id ?? "" });
    }

    const deliveries = framer ? await this.deliveries.listByConnection(input.siteId, framer.id) : [];
    return {
      blog,
      destinations,
      deliveries: deliveries
        .filter((row) => row.blog_id === input.blogId)
        .map((row) => ({ provider: row.provider, status: row.status })),
    };
  }

  private async enqueueOrRun(job: { deliveryId: string; siteId: string; connectionId: string }): Promise<void> {
    const idempotencyKey = (await this.deliveries.findById(job.deliveryId))?.idempotency_key;
    if (!idempotencyKey) return;
    if (isIntegrationPublishQueueConnected) {
      await integrationPublishQueue.add(job, { jobId: idempotencyKey });
      return;
    }
    try {
      await this.processor.handle({ data: job, id: idempotencyKey } as never);
    } catch (error) {
      logger.error(
        "Inline Framer publish failed",
        error instanceof Error ? error : new Error(String(error)),
        job,
        "PublishRouterService"
      );
    }
  }
}
