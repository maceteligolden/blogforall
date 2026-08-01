import type { Socket } from "socket.io";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { REALTIME_LOG_CONTEXT, INFRA_EVENTS } from "../realtime.constants";
import { realtimeMetrics } from "../observability/realtime.metrics";
import { getConnectionContext } from "../auth/socket-auth.middleware";
import { realtimeLogFields } from "../observability/realtime-log.context";
import { buildRealtimeEnvelope } from "../contracts/realtime-envelope";

interface WindowState {
  count: number;
  windowStart: number;
}

const windows = new WeakMap<Socket, WindowState>();

/**
 * Returns true if the event should be allowed; false if rate-limited.
 */
export function assertSocketInboundRateLimit(socket: Socket): boolean {
  const max = env.realtime?.inboundRateLimitMax ?? 60;
  const windowMs = env.realtime?.inboundRateLimitWindowMs ?? 60_000;
  const now = Date.now();
  let state = windows.get(socket);
  if (!state || now - state.windowStart >= windowMs) {
    state = { count: 0, windowStart: now };
    windows.set(socket, state);
  }
  state.count += 1;
  if (state.count > max) {
    realtimeMetrics.inc("realtime.events.rate_limited");
    const ctx = getConnectionContext(socket);
    logger.warn(
      "Socket inbound rate limit exceeded",
      realtimeLogFields({
        connectionId: ctx?.connectionId,
        socketId: socket.id,
        userId: ctx?.userId,
        reason: "rate_limited",
      }),
      REALTIME_LOG_CONTEXT
    );
    const envelope = buildRealtimeEnvelope(INFRA_EVENTS.ERROR, {
      code: "rate_limited",
      message: "Too many realtime events; slow down",
    });
    socket.emit(INFRA_EVENTS.ERROR, envelope);
    return false;
  }
  return true;
}

/** Clear rate-limit state (tests). */
export function clearSocketRateLimitState(socket: Socket): void {
  windows.delete(socket);
}
