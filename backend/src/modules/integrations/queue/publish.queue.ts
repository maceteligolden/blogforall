import Bull from "bull";
import { env } from "../../../shared/config/env";
import { INTEGRATION_PUBLISH_MAX_ATTEMPTS } from "../constants";

export type IntegrationPublishJob = {
  deliveryId: string;
  siteId: string;
  connectionId: string;
};

const redisUrl = (env.notification.redisUrl || "").trim();
const useRedis = redisUrl.length > 0;

const noOpQueue = {
  add: async () => ({}) as Bull.Job<IntegrationPublishJob>,
  process: (_job: Bull.Job<IntegrationPublishJob>) => {
    void _job;
  },
  on: () => noOpQueue,
  getJob: async () => null,
  removeJobs: async () => undefined,
};

const queue: Bull.Queue<IntegrationPublishJob> = useRedis
  ? new Bull<IntegrationPublishJob>(env.notification.integrationPublishQueueName, redisUrl, {
      defaultJobOptions: {
        attempts: INTEGRATION_PUBLISH_MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : (noOpQueue as unknown as Bull.Queue<IntegrationPublishJob>);

export const integrationPublishQueue = queue;
export const isIntegrationPublishQueueConnected = useRedis;
