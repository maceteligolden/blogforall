import { getOrCreateSessionId } from "./session";

/** Correlation headers attached to every API request. */
export function getCorrelationHeaders(): Record<string, string> {
  return {
    "X-Request-Id": crypto.randomUUID(),
    "X-Session-Id": getOrCreateSessionId(),
  };
}
