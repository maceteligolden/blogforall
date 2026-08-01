import type { ExtendedError, Socket } from "socket.io";
import { verifyAccessToken } from "../../utils/token";
import { logger } from "../../utils/logger";
import { REALTIME_LOG_CONTEXT } from "../realtime.constants";
import { realtimeMetrics } from "../observability/realtime.metrics";
import { realtimeLogFields } from "../observability/realtime-log.context";
import type { ConnectionContext, SocketAuthFailure } from "../realtime.types";
import { randomUUID } from "crypto";

function classifyJwtError(err: unknown): SocketAuthFailure {
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "TokenExpiredError") {
    return { code: "auth_expired", message: "Access token expired" };
  }
  return { code: "auth_invalid", message: "Invalid access token" };
}

/**
 * Socket.io middleware: require handshake.auth.token (access JWT).
 * Never reads token from query string.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: ExtendedError) => void): void {
  const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;

  if (typeof token !== "string" || !token.trim()) {
    realtimeMetrics.inc("realtime.auth.failures");
    logger.warn(
      "Socket auth failed: missing token",
      realtimeLogFields({ socketId: socket.id, reason: "auth_required" }),
      REALTIME_LOG_CONTEXT
    );
    const err = new Error("Authentication required") as ExtendedError;
    err.data = { code: "auth_required" };
    return next(err);
  }

  try {
    const payload = verifyAccessToken(token.trim());
    const connectionId = randomUUID();
    const ctx: ConnectionContext = {
      connectionId,
      socketId: socket.id,
      userId: payload.userId,
      email: payload.email,
      currentSiteId: payload.currentSiteId,
      connectedAt: new Date(),
      joinedSiteIds: new Set(),
    };
    socket.data.connection = ctx;
    next();
  } catch (err) {
    const failure = classifyJwtError(err);
    realtimeMetrics.inc("realtime.auth.failures");
    logger.warn(
      "Socket auth failed",
      realtimeLogFields({ socketId: socket.id, reason: failure.code }),
      REALTIME_LOG_CONTEXT
    );
    const e = new Error(failure.message) as ExtendedError;
    e.data = { code: failure.code };
    next(e);
  }
}

export function getConnectionContext(socket: Socket): ConnectionContext | undefined {
  return socket.data?.connection as ConnectionContext | undefined;
}
