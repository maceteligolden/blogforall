"use client";

import type { AnalyticsEventName } from "./events";
import type { EventProperties } from "./properties";
import { sanitizeEventProperties } from "./properties";
import { getOrCreateSessionId } from "../observability/session";
import {
  capturePostHogEvent,
  groupPostHogWorkspace,
  identifyPostHogUser,
  initPostHog,
  isPostHogEnabled,
  resetPostHogClient,
} from "./destinations/posthog";
import {
  captureGa4Event,
  captureGa4PageView,
  identifyGa4User,
  initGA4,
  isGa4Enabled,
  resetGa4,
  setGa4Workspace,
} from "./destinations/ga4";

export { initPostHog, isPostHogEnabled, getPostHogClient } from "./destinations/posthog";
export { isGa4Enabled } from "./destinations/ga4";

function getEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "development"
  );
}

export type AnalyticsOverrides = {
  userId?: string | null;
  workspaceId?: string | null;
  planType?: string;
};

export function isAnalyticsEnabled(): boolean {
  return isPostHogEnabled() || isGa4Enabled();
}

export function initAnalytics(): void {
  initPostHog();
  initGA4();
}

/** Resolve base properties from optional overrides (for use outside React). */
export function resolveBaseProperties(overrides?: AnalyticsOverrides): Record<string, unknown> {
  return {
    session_id: typeof window !== "undefined" ? getOrCreateSessionId() : undefined,
    environment: getEnvironment(),
    ...(overrides?.userId ? { user_id: overrides.userId } : {}),
    ...(overrides?.workspaceId ? { workspace_id: overrides.workspaceId } : {}),
    ...(overrides?.planType ? { plan_type: overrides.planType } : {}),
  };
}

/**
 * Typed event capture — never throws.
 * Fans out to PostHog and GA4. Pass base context via overrides when calling
 * outside React (e.g. from axios interceptor).
 */
export function captureEvent(
  event: AnalyticsEventName,
  properties?: EventProperties,
  overrides?: AnalyticsOverrides
): void {
  try {
    const merged = sanitizeEventProperties({
      ...resolveBaseProperties(overrides),
      ...(properties as Record<string, unknown>),
    });

    capturePostHogEvent(event, merged);
    captureGa4Event(event, merged);
  } catch {
    // Analytics must never break the app
  }
}

export function capturePageView(path: string): void {
  try {
    const href = typeof window !== "undefined" ? window.location.href : path;
    capturePostHogEvent("$pageview" as AnalyticsEventName, {
      ...sanitizeEventProperties(resolveBaseProperties()),
      $current_url: href,
      path,
    });
    captureGa4PageView(path);
  } catch {
    // swallow
  }
}

export function identifyUser(
  userId: string,
  traits?: { email?: string; plan?: string; first_name?: string; last_name?: string }
): void {
  try {
    identifyPostHogUser(userId, traits);
    identifyGa4User(userId, { plan: traits?.plan });
  } catch {
    // swallow
  }
}

export function groupWorkspace(workspaceId: string, traits?: { name?: string; plan?: string }): void {
  try {
    groupPostHogWorkspace(workspaceId, traits);
    setGa4Workspace(workspaceId);
  } catch {
    // swallow
  }
}

export function resetAnalytics(): void {
  try {
    resetPostHogClient();
    resetGa4();
  } catch {
    // swallow
  }
}

/** @deprecated Use resetAnalytics — kept so existing imports keep working. */
export function resetPostHog(): void {
  resetAnalytics();
}
