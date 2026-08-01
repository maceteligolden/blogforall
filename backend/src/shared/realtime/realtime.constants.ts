import { MAX_SOCKET_CONNECTIONS_PER_USER } from "../constants/notification.constant";

/** Default Socket.io namespace for authenticated realtime traffic. */
export const REALTIME_NAMESPACE_DEFAULT = "/realtime";

/** Default Socket.io HTTP path. */
export const REALTIME_PATH_DEFAULT = "/socket.io";

/** Max concurrent sockets per authenticated user (fallback). */
export const REALTIME_MAX_CONNECTIONS_PER_USER_DEFAULT =
  MAX_SOCKET_CONNECTIONS_PER_USER || 3;

/** Client → server event names. */
export const CLIENT_EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
} as const;

/** Infra server → client event names. */
export const INFRA_EVENTS = {
  ERROR: "realtime:error",
  CONNECTED: "realtime:connected",
} as const;

/** Redis key prefix for Socket.io adapter (avoid Bull collision). */
export const REALTIME_REDIS_KEY_PREFIX = "realtime:socket.io:";

export const REALTIME_LOG_CONTEXT = "Realtime";

/** @deprecated Prefer env.realtime.namespace at attach time. */
export const REALTIME_NAMESPACE = REALTIME_NAMESPACE_DEFAULT;

/** @deprecated Prefer env.realtime.path at attach time. */
export const REALTIME_PATH = REALTIME_PATH_DEFAULT;

/** @deprecated Prefer env.realtime.maxConnectionsPerUser at attach time. */
export const REALTIME_MAX_CONNECTIONS_PER_USER = REALTIME_MAX_CONNECTIONS_PER_USER_DEFAULT;
