import { AnalyticsEvents } from "../events";
import type { BillingEventProperties } from "../properties";
import { captureEvent } from "../posthog";

export const billingTracker = {
  viewed: (props?: BillingEventProperties) =>
    captureEvent(AnalyticsEvents.BILLING_VIEWED, props),

  paymentMethodAdded: (props?: BillingEventProperties) =>
    captureEvent(AnalyticsEvents.PAYMENT_METHOD_ADDED, props),

  planChanged: (props: BillingEventProperties & { previous_plan: string; new_plan: string }) =>
    captureEvent(AnalyticsEvents.PLAN_CHANGED, props),

  subscriptionCancelled: (props?: BillingEventProperties) =>
    captureEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED, props),
};
