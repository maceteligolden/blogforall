/**
 * PSEUDOCODE (module): CREATE Bull queue with name and Redis URL from env; default job options: max attempts, exponential backoff, removeOnComplete/removeOnFail. Export queue for add() and process(). When Redis URL is missing/empty, use a no-op stub so the server can run without Redis.
 */
import Bull from "bull";
import { env } from "../../../shared/config/env";
import { EMAIL_JOB_MAX_ATTEMPTS } from "../../../shared/constants/notification.constant";
import type { EmailJobPayload } from "../interfaces/email-job.interface";

const redisUrl = (env.notification.redisUrl || "").trim();
const useRedis = redisUrl.length > 0;

const noOpQueue = {
  add: async () => ({}) as Bull.Job<EmailJobPayload>,
  process: () => {},
  on: () => noOpQueue,
};

const queue: Bull.Queue<EmailJobPayload> = useRedis
  ? new Bull<EmailJobPayload>(env.notification.emailQueueName, redisUrl, {
      defaultJobOptions: {
        attempts: EMAIL_JOB_MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : (noOpQueue as unknown as Bull.Queue<EmailJobPayload>);

export const emailQueue = queue;
export const isEmailQueueConnected = useRedis;
