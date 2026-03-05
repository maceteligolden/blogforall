import { randomUUID } from "crypto";

/** Generates a unique notification id (UUID v4) for traceability. */
export function generateNotificationId(): string {
  return randomUUID();
}

/** Generates a correlation id (UUID v4) to trace all notifications from one business event. */
export function generateCorrelationId(): string {
  return randomUUID();
}
