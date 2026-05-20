import { PostHog } from "posthog-node";
import { env } from "../config/env";
import { getRequestContext } from "../observability/request-context";
import { logger } from "../utils/logger";

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.posthog.enabled || !env.posthog.apiKey) {
    return null;
  }
  if (!client) {
    client = new PostHog(env.posthog.apiKey, {
      host: env.posthog.host,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export const ServerAnalyticsEvents = {
  USER_SIGNED_UP: "user signed up",
  USER_ONBOARDING_COMPLETED: "user onboarding completed",
  WORKSPACE_ONBOARDING_COMPLETED: "workspace onboarding completed",
  SUBSCRIPTION_CHANGED: "subscription changed",
  GENERATION_SUCCESS: "generation success",
} as const;

export type ServerAnalyticsEvent =
  (typeof ServerAnalyticsEvents)[keyof typeof ServerAnalyticsEvents];

export interface ServerCaptureOptions {
  userId: string;
  workspaceId?: string;
  properties?: Record<string, unknown>;
}

export function captureServerEvent(
  event: ServerAnalyticsEvent,
  options: ServerCaptureOptions
): void {
  try {
    const ph = getClient();
    if (!ph) return;

    const ctx = getRequestContext();
    const props: Record<string, unknown> = {
      environment: env.posthog.environment,
      ...(ctx?.requestId ? { request_id: ctx.requestId } : {}),
      ...(ctx?.sessionId ? { session_id: ctx.sessionId } : {}),
      ...(options.workspaceId ? { workspace_id: options.workspaceId } : {}),
      ...options.properties,
    };

    ph.capture({
      distinctId: options.userId,
      event,
      properties: props,
    });
  } catch (error) {
    logger.warn(
      "PostHog capture failed",
      { event, error: error instanceof Error ? error.message : String(error) },
      "PostHogServer"
    );
  }
}

export function identifyServerUser(
  userId: string,
  traits?: Record<string, unknown>
): void {
  try {
    const ph = getClient();
    if (!ph) return;
    ph.identify({ distinctId: userId, properties: traits });
  } catch {
    // swallow
  }
}

export async function shutdownPostHog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
