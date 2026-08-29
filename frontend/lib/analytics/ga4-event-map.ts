import { AnalyticsEvents, type AnalyticsEventName } from "./events";

/**
 * Product catalog names → GA4 event names.
 * GA4 requires snake_case, ≤40 characters. Prefer recommended events where they exist.
 */
const GA4_EVENT_MAP: Partial<Record<AnalyticsEventName, string>> = {
  [AnalyticsEvents.LOGIN_SUCCESS]: "login",
  [AnalyticsEvents.SIGNUP_COMPLETED]: "sign_up",
  [AnalyticsEvents.USER_SIGNED_UP]: "sign_up",
  [AnalyticsEvents.LOGOUT]: "logout",
  [AnalyticsEvents.PLAN_SELECTED]: "plan_selected",
  [AnalyticsEvents.PLAN_CHANGED]: "plan_changed",
  [AnalyticsEvents.GENERATION_SUCCESS]: "generation_success",
  [AnalyticsEvents.BLOG_PUBLISHED]: "publish_post",
  [AnalyticsEvents.ORCHESTRATOR_MESSAGE_SENT]: "orchestrator_message_sent",
};

const GA4_SKIP = new Set<string>([AnalyticsEvents.PAGE_VIEW]);

export function toGa4EventName(event: AnalyticsEventName): string | null {
  if (GA4_SKIP.has(event)) return null;
  const mapped = GA4_EVENT_MAP[event];
  if (mapped) return mapped;
  return event
    .replace(/\$/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 40);
}
