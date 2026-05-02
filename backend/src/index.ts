import "reflect-metadata";
import express from "express";
import "dotenv/config";
import path from "path";
import { connectDatabase } from "./shared/database";
import { logger } from "./shared/utils/logger";
import { errorHandler } from "./shared/middlewares/error-handler.middleware";
import { requestLogger } from "./shared/middlewares/request-logger.middleware";
import { routes } from "./routes";
import { seedPlansIfNeeded } from "./shared/utils/seed-plans.util";
import { env } from "./shared/config/env";
import { container } from "tsyringe";
import { PostSchedulerService } from "./modules/campaign/services/post-scheduler.service";
import { EmailJobProcessor } from "./modules/notification/queue/email-job.processor";
import { emailQueue, isEmailQueueConnected } from "./modules/notification/queue/email.queue";
import { corsMiddleware } from "./shared/middlewares/cors.middleware";
import { backfillSitePublicIds } from "./shared/utils/backfill-site-public-ids";

const app = express();
const PORT = env.port;

// Serve uploaded images statically (before other middlewares to avoid conflicts)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Middlewares
app.use(requestLogger);

// Webhook routes need raw body for Stripe signature verification
// Must be before JSON body parser - handle webhooks first
app.use("/api/v1/webhooks", express.raw({ type: "application/json" }));

// JSON body parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(corsMiddleware);

// Routes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Bloggr API is running" });
});

app.use("/api/v1", routes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();

    await backfillSitePublicIds();

    // Seed plans if none exist
    await seedPlansIfNeeded();

    // Start the post scheduler
    const scheduler = container.resolve(PostSchedulerService);
    scheduler.start();

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

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {}, "Server");
    });
  } catch (error) {
    logger.error("Failed to start server", error as Error, {}, "Server");
    process.exit(1);
  }
};

startServer();
