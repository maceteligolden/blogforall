"use client";

import { useCallback } from "react";
import { useAuthStore } from "../../store/auth.store";
import type { AnalyticsEventName } from "../events";
import type { EventProperties } from "../properties";
import { captureEvent } from "../posthog";

export function useTrackEvent() {
  const userId = useAuthStore((s) => s.user?.id);
  const workspaceId = useAuthStore((s) => s.currentSiteId);
  const planType = useAuthStore((s) => s.user?.plan);

  return useCallback(
    (event: AnalyticsEventName, properties?: EventProperties) => {
      captureEvent(event, properties, {
        userId: userId ?? null,
        workspaceId,
        planType,
      });
    },
    [userId, workspaceId, planType]
  );
}
