"use client";

import posthog from "posthog-js";
import type { AnalyticsEventName } from "../events";

let initialized = false;

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

export function capturePostHogEvent(event: AnalyticsEventName, properties: Record<string, unknown>): void {
  if (!isPostHogEnabled()) return;
  if (!initialized) initPostHog();
  const client = getPostHogClient();
  if (!client) return;
  client.capture(event, properties);
}

export function identifyPostHogUser(
  userId: string,
  traits?: {
    email?: string;
    plan?: string;
    first_name?: string;
    last_name?: string;
    account_type?: string;
    is_approved?: boolean;
    terms_version?: string;
  }
): void {
  if (!isPostHogEnabled()) return;
  if (!initialized) initPostHog();
  const client = getPostHogClient();
  if (!client) return;
  client.identify(userId, traits);
}

export function groupPostHogWorkspace(workspaceId: string, traits?: { name?: string; plan?: string }): void {
  if (!isPostHogEnabled()) return;
  if (!initialized) initPostHog();
  const client = getPostHogClient();
  if (!client) return;
  client.group("workspace", workspaceId, traits);
}

export function resetPostHogClient(): void {
  const client = getPostHogClient();
  if (!client) return;
  client.reset();
}
