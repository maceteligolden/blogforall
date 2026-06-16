"use client";

import { useCallback } from "react";
import { AnalyticsEvents } from "../events";
import type { OnboardingEventProperties } from "../properties";
import { useTrackEvent } from "./use-track-event";

export function useTrackFlowStep() {
  const track = useTrackEvent();

  return useCallback(
    (step: string, props?: Omit<OnboardingEventProperties, "step">) => {
      track(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, {
        step,
        ...props,
      });
    },
    [track]
  );
}
