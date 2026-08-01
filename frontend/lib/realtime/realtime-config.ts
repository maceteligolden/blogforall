/**
 * Derive Socket.io server URL from env.
 * Prefer NEXT_PUBLIC_WS_URL; otherwise strip /api/v1 from API base.
 */
export function getRealtimeServerUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
  return api.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "") || "http://localhost:3001";
}

export const REALTIME_NAMESPACE = "/realtime";
export const REALTIME_PATH = "/socket.io";
