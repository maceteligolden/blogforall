import type { Socket } from "socket.io";
import { logger } from "../../utils/logger";
import { REALTIME_LOG_CONTEXT, INFRA_EVENTS } from "../realtime.constants";
import { getConnectionContext } from "../auth/socket-auth.middleware";
import { realtimeLogFields } from "../observability/realtime-log.context";
import { buildRealtimeEnvelope } from "../contracts/realtime-envelope";

const MAX_JSON_CHARS = 32_768;
const MAX_DEPTH = 8;

function depthOf(value: unknown, depth = 0): number {
  if (depth > MAX_DEPTH) return depth;
  if (value === null || typeof value !== "object") return depth;
  if (Array.isArray(value)) {
    let max = depth;
    for (const item of value) {
      max = Math.max(max, depthOf(item, depth + 1));
    }
    return max;
  }
  let max = depth;
  for (const item of Object.values(value as Record<string, unknown>)) {
    max = Math.max(max, depthOf(item, depth + 1));
  }
  return max;
}

/**
 * Reject oversized or deeply nested inbound payloads.
 */
export function assertSocketPayloadSafe(socket: Socket, payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload ?? null);
    if (serialized.length > MAX_JSON_CHARS) {
      reject(socket, "payload_too_large", "Payload exceeds maximum size");
      return false;
    }
    if (depthOf(payload) > MAX_DEPTH) {
      reject(socket, "payload_too_deep", "Payload nesting exceeds maximum depth");
      return false;
    }
    return true;
  } catch {
    reject(socket, "payload_invalid", "Payload could not be validated");
    return false;
  }
}

function reject(socket: Socket, code: string, message: string): void {
  const ctx = getConnectionContext(socket);
  logger.warn(
    "Socket payload rejected",
    realtimeLogFields({
      connectionId: ctx?.connectionId,
      socketId: socket.id,
      userId: ctx?.userId,
      reason: code,
    }),
    REALTIME_LOG_CONTEXT
  );
  socket.emit(
    INFRA_EVENTS.ERROR,
    buildRealtimeEnvelope(INFRA_EVENTS.ERROR, { code, message })
  );
}
