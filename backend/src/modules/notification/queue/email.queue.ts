import Bull from "bull";
import { NotificationConfig, EMAIL_JOB_MAX_ATTEMPTS } from "../../../shared/constants/notification.constant";
import type { EmailJobPayload } from "./email-job.payload";

const queue = new Bull<EmailJobPayload>(NotificationConfig.emailQueueName, NotificationConfig.redisUrl, {
  defaultJobOptions: {
    attempts: EMAIL_JOB_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const emailQueue = queue;
