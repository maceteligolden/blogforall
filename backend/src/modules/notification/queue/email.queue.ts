/**
 * PSEUDOCODE (module): CREATE Bull queue with name and Redis URL from env; default job options: max attempts, exponential backoff, removeOnComplete/removeOnFail. Export queue for add() and process().
 */
import Bull from "bull";
import { env } from "../../../shared/config/env";
import { EMAIL_JOB_MAX_ATTEMPTS } from "../../../shared/constants/notification.constant";
import type { EmailJobPayload } from "../interfaces/email-job.interface";

const queue = new Bull<EmailJobPayload>(env.notification.emailQueueName, env.notification.redisUrl, {
  defaultJobOptions: {
    attempts: EMAIL_JOB_MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const emailQueue = queue;
