import { AnalyticsEvents } from "../events";
import type { LandingEventProperties } from "../properties";
import { captureEvent } from "../client";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";

export const landingTracker = {
  ctaClicked: (props: LandingEventProperties) =>
    captureEvent(AnalyticsEvents.LANDING_CTA_CLICKED, {
      waitlist_mode: IS_WAITLIST_MODE,
      ...props,
    }),

  pricingLockedClicked: (props?: LandingEventProperties) =>
    captureEvent(AnalyticsEvents.LANDING_PRICING_LOCKED_CLICKED, props),
};
