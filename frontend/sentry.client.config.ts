import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        (process.env.NODE_ENV === "production" ? "0.1" : "1.0")
    ),
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false",
    integrations: [Sentry.browserTracingIntegration()],
    tracePropagationTargets: [
      "localhost",
      /^https?:\/\/localhost:\d+/,
      ...(process.env.NEXT_PUBLIC_API_URL ? [process.env.NEXT_PUBLIC_API_URL] : []),
    ],
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers.authorization) headers.authorization = "[REDACTED]";
      }
      return event;
    },
  });
}
