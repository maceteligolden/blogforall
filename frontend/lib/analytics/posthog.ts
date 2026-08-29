"use client";

/**
 * Backward-compatible analytics entry. Implementation lives in `client.ts`
 * and fans out to PostHog + GA4 destinations.
 */
export {
  captureEvent,
  capturePageView,
  groupWorkspace,
  identifyUser,
  initAnalytics,
  initPostHog,
  isAnalyticsEnabled,
  isGa4Enabled,
  isPostHogEnabled,
  resetAnalytics,
  resetPostHog,
  resolveBaseProperties,
} from "./client";

export { getPostHogClient } from "./destinations/posthog";
