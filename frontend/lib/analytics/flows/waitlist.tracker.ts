import { AnalyticsEvents } from "../events";
import type { WaitlistEventProperties } from "../properties";
import { captureEvent } from "../client";

export const waitlistTracker = {
  joinStarted: (props?: WaitlistEventProperties) => captureEvent(AnalyticsEvents.WAITLIST_JOIN_STARTED, props),

  joined: (props?: WaitlistEventProperties) => captureEvent(AnalyticsEvents.WAITLIST_JOINED, props),

  joinFailed: (props?: WaitlistEventProperties) => captureEvent(AnalyticsEvents.WAITLIST_JOIN_FAILED, props),
};
