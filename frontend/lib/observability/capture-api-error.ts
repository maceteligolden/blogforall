import * as Sentry from "@sentry/nextjs";
import { isAxiosError } from "axios";
import { AnalyticsEvents } from "../analytics/events";
import { captureEvent } from "../analytics/posthog";

export function captureApiError(error: unknown, context?: { url?: string; method?: string }): void {
  try {
    if (isAxiosError(error)) {
      const status = error.response?.status;
      const requestId =
        (error.response?.headers?.["x-request-id"] as string | undefined) ??
        (error.config?.headers?.["X-Request-Id"] as string | undefined);

      if (status && status < 500) {
        return;
      }

      Sentry.withScope((scope) => {
        if (requestId) scope.setTag("requestId", requestId);
        if (context?.url) scope.setTag("apiUrl", context.url);
        if (context?.method) scope.setTag("apiMethod", context.method);
        if (status) scope.setTag("httpStatus", String(status));
        Sentry.captureException(error);
      });

      captureEvent(AnalyticsEvents.API_CALL_FAILED, {
        endpoint: context?.url,
        method: context?.method,
        status,
        request_id: requestId,
      });
      return;
    }

    Sentry.captureException(error);
  } catch {
    // Never break UI on observability failure
  }
}
