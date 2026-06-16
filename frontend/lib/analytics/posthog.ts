"use client";

import posthog from "posthog-js";
import type { AnalyticsEventName } from "./events";
import type { EventProperties } from "./properties";
import { sanitizeEventProperties } from "./properties";
import { getOrCreateSessionId } from "../observability/session";

let initialized = false;

function getEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "development"
  );
}

export function isPostHogEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "false") return false;
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
}

export function initPostHog(): void {
  if (initialized || !isPostHogEnabled()) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY!.trim();
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").trim();
  const replaySample = parseFloat(
    process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE ??
      (process.env.NODE_ENV === "production" ? "0.1" : "1.0")
  );

  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    disable_session_recording: replaySample <= 0,
    loaded: (ph) => {
      if (replaySample < 1 && replaySample > 0) {
        if (Math.random() > replaySample) {
          ph.stopSessionRecording();
        }
      }
    },
  });

  initialized = true;
}

export function getPostHogClient(): typeof posthog | null {
  if (!isPostHogEnabled() || !initialized) return null;
  return posthog;
}

/** Resolve base properties from optional overrides (for use outside React). */
export function resolveBaseProperties(overrides?: {
  userId?: string | null;
  workspaceId?: string | null;
  planType?: string;
}): Record<string, unknown> {
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
 * Pass base context via overrides when calling outside React (e.g. from axios interceptor).
 */
export function captureEvent(
  event: AnalyticsEventName,
  properties?: EventProperties,
  overrides?: {
    userId?: string | null;
    workspaceId?: string | null;
    planType?: string;
  }
): void {
  try {
    if (!isPostHogEnabled()) return;
    const client = getPostHogClient();
    if (!client) return;

    const merged = {
      ...resolveBaseProperties(overrides),
      ...(properties as Record<string, unknown>),
    };

    client.capture(event, sanitizeEventProperties(merged));
  } catch {
    // Analytics must never break the app
  }
}

export function identifyUser(
  userId: string,
  traits?: { email?: string; plan?: string; first_name?: string; last_name?: string }
): void {
  try {
    if (!isPostHogEnabled()) return;
    const client = getPostHogClient();
    if (!client) return;
    client.identify(userId, traits);
  } catch {
    // swallow
  }
}

export function groupWorkspace(
  workspaceId: string,
  traits?: { name?: string; plan?: string }
): void {
  try {
    if (!isPostHogEnabled()) return;
    const client = getPostHogClient();
    if (!client) return;
    client.group("workspace", workspaceId, traits);
  } catch {
    // swallow
  }
}

export function resetPostHog(): void {
  try {
    if (!isPostHogEnabled()) return;
    const client = getPostHogClient();
    if (!client) return;
    client.reset();
  } catch {
    // swallow
  }
}

export function capturePageView(path: string): void {
  captureEvent("$pageview" as AnalyticsEventName, {
    $current_url: typeof window !== "undefined" ? window.location.href : path,
    path,
  });
}
