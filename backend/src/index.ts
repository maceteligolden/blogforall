import "reflect-metadata";
import "./instrument";
import http from "http";
import express from "express";
import path from "path";
import { connectDatabase } from "./shared/database";
import { logger } from "./shared/utils/logger";
import { errorHandler } from "./shared/middlewares/error-handler.middleware";
import { registerGoogleDriveCallbackRoute } from "./modules/memory/controllers/google-drive-callback.controller";
import { requestLogger } from "./shared/middlewares/request-logger.middleware";
import { routes } from "./routes";
import { seedPlansIfNeeded, syncFreePlanTokenLimit } from "./shared/utils/seed-plans.util";
import { env } from "./shared/config/env";
import { container } from "tsyringe";
import { PostSchedulerService } from "./modules/campaign/services/post-scheduler.service";
import { OrchestratorBootstrap } from "./modules/orchestrator/ai/bootstrap";
import { WeeklyDigestService } from "./modules/orchestrator/services/weekly-digest.service";
import { MemoryDigestService } from "./modules/orchestrator/services/memory-digest.service";
import { CampaignProgressEmailService } from "./modules/campaign/services/campaign-progress-email.service";
import { CampaignProgressReportCronService } from "./modules/campaign/services/campaign-progress-report-cron.service";
import { EmailJobProcessor } from "./modules/notification/queue/email-job.processor";
import { emailQueue, isEmailQueueConnected } from "./modules/notification/queue/email.queue";
import { IntegrationPublishProcessor } from "./modules/integrations/queue/publish-job.processor";
import {
  integrationPublishQueue,
  isIntegrationPublishQueueConnected,
} from "./modules/integrations/queue/publish.queue";
import { corsMiddleware } from "./shared/middlewares/cors.middleware";
import { requestContextMiddleware } from "./shared/middlewares/request-context.middleware";
import { backfillSitePublicIds } from "./shared/utils/backfill-site-public-ids";
import { backfillOrchestratorThreads } from "./shared/utils/backfill-orchestrator-threads";
import { OrchestratorThreadRepository } from "./modules/orchestrator/repositories/orchestrator-thread.repository";
import { setupExpressErrorHandler, isSentryEnabled } from "./shared/observability/sentry";
import { seedPlatformAdminIfNeeded } from "./shared/utils/seed-platform-admin.util";
import { SocketIoRealtimeGateway } from "./shared/realtime";

const app = express();
const server = http.createServer(app);
const PORT = env.port;

let shuttingDown = false;

// CORS must run before body parsers and routes (especially OPTIONS preflight)
app.use(corsMiddleware);

// Serve uploaded images statically (before other middlewares to avoid conflicts)
app.use("/uploads", express.static(path.join(process.cwd(), env.upload.dir)));

// Middlewares — requestContext first for correlation (requestId, Sentry scope)
app.use(requestContextMiddleware);
app.use(requestLogger);

// Webhook routes need raw body for Stripe signature verification
// Must be before JSON body parser - handle webhooks first
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }));

// JSON body parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", message: "Bloggr API is running" });
});

app.use("/api/v1", routes);

registerGoogleDriveCallbackRoute(app);

if (isSentryEnabled()) {
  setupExpressErrorHandler(app);
}

// Custom error handler (must be last)
app.use(errorHandler);

async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully`, {}, "Server");

  try {
    const gateway = container.resolve(SocketIoRealtimeGateway);
    await gateway.close();
  } catch (err) {
    logger.error("Error closing realtime gateway", err instanceof Error ? err : new Error(String(err)), {}, "Server");
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(() => resolve(), 10_000).unref();
  });

  process.exit(0);
}

// Start server
const startServer = async () => {
  try {
    await connectDatabase();

    await backfillSitePublicIds();
    try {
      await backfillOrchestratorThreads(container.resolve(OrchestratorThreadRepository));
    } catch (err) {
      logger.error(
        "Orchestrator thread backfill failed; continuing startup",
        err instanceof Error ? err : new Error(String(err)),
        {},
        "Server"
      );
    }

    // Seed plans if none exist
    await seedPlansIfNeeded();
    await syncFreePlanTokenLimit();

    if (env.adminSeed.onStart) {
      await seedPlatformAdminIfNeeded({
        email: env.adminSeed.email,
        password: env.adminSeed.password,
        firstName: env.adminSeed.firstName,
        lastName: env.adminSeed.lastName,
        roleRaw: env.adminSeed.role,
      });
    }

    // Register Workspace Orchestrator Agent tools before serving traffic so
    // the chat endpoints can dispatch to them on the first request.
    container.resolve(OrchestratorBootstrap).registerAllTools();
    logger.info(
      env.orchestrator.v05GraphEnabled
        ? "Orchestrator v0.5 graph enabled (default active chat brain)"
        : "Orchestrator v0.5 graph disabled — supervisor handles active chat",
      { v05GraphEnabled: env.orchestrator.v05GraphEnabled },
      "Orchestrator"
    );

    // Start the post scheduler
    const scheduler = container.resolve(PostSchedulerService);
    scheduler.start();

    // Start the weekly review digest cron (one email per recipient
    // rolling up posts that still need pre-publish approval).
    const weeklyDigest = container.resolve(WeeklyDigestService);
    weeklyDigest.start();

    const memoryDigest = container.resolve(MemoryDigestService);
    memoryDigest.start();

    const campaignProgressReportCron = container.resolve(CampaignProgressReportCronService);
    campaignProgressReportCron.start();

    const campaignProgressEmail = container.resolve(CampaignProgressEmailService);
    campaignProgressEmail.start();

    // Start the email notification queue worker only when Redis is configured
    if (isEmailQueueConnected) {
      const emailProcessor = container.resolve(EmailJobProcessor);
      emailQueue.process((job) => emailProcessor.handle(job));
      emailQueue.on("failed", (job, err) => {
        logger.error(
          "Email queue job failed",
          err,
          {
            jobId: job?.id,
            notificationId: job?.data?.notificationId,
            templateKey: job?.data?.templateKey,
            attempt: job?.attemptsMade,
          },
          "EmailQueue"
        );
      });
      let lastEmailQueueErrorLog = 0;
      const EMAIL_QUEUE_ERROR_LOG_INTERVAL_MS = 60_000;
      emailQueue.on("error", (err) => {
        const now = Date.now();
        if (now - lastEmailQueueErrorLog >= EMAIL_QUEUE_ERROR_LOG_INTERVAL_MS) {
          lastEmailQueueErrorLog = now;
          logger.error("Email queue error (e.g. Redis connection)", err, {}, "EmailQueue");
        }
      });
    } else {
      logger.info("Email queue disabled (no REDIS_URL); notifications will not be sent", {}, "EmailQueue");
    }

    if (isIntegrationPublishQueueConnected) {
      const publishProcessor = container.resolve(IntegrationPublishProcessor);
      integrationPublishQueue.process((job) => publishProcessor.handle(job));
      integrationPublishQueue.on("failed", (job, err) => {
        logger.error(
          "Integration publish job failed",
          err,
          { jobId: job?.id, deliveryId: job?.data?.deliveryId, attempt: job?.attemptsMade, flow: "publish" },
          "IntegrationPublishQueue"
        );
      });
    } else {
      logger.info(
        "Integration publish queue disabled (no REDIS_URL); Framer publishes run inline",
        {},
        "IntegrationPublishQueue"
      );
    }

    const realtimeGateway = container.resolve(SocketIoRealtimeGateway);
    await realtimeGateway.attach(server);

    server.listen(PORT, () => {
      logger.info(
        `Server running on port ${PORT}`,
        { entry: __filename, node: process.version, nodeEnv: env.nodeEnv },
        "Server"
      );
    });

    process.on("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });
  } catch (error) {
    logger.error("Failed to start server", error as Error, {}, "Server");
    process.exit(1);
  }
};

startServer();
