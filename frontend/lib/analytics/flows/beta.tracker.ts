import { AnalyticsEvents } from "../events";
import type { BetaEventProperties } from "../properties";
import { captureEvent } from "../client";

export const betaTracker = {
  termsAccepted: (props?: BetaEventProperties) => captureEvent(AnalyticsEvents.TERMS_ACCEPTED, props),

  waitingViewed: (props?: BetaEventProperties) => captureEvent(AnalyticsEvents.BETA_WAITING_VIEWED, props),

  statusChecked: (props?: BetaEventProperties) => captureEvent(AnalyticsEvents.BETA_STATUS_CHECKED, props),

  planUpgradeBlocked: (props?: BetaEventProperties) => captureEvent(AnalyticsEvents.PLAN_UPGRADE_BLOCKED, props),
};
