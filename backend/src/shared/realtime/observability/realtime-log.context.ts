import type { ConnectionContext } from "../realtime.types";

export function realtimeLogFields(
  ctx: Partial<ConnectionContext> & {
    correlationId?: string;
    eventName?: string;
    siteId?: string;
    eventId?: string;
    reason?: string;
  }
): Record<string, unknown> {
  return {
    connectionId: ctx.connectionId,
    socketId: ctx.socketId,
    userId: ctx.userId,
    siteId: ctx.siteId ?? ctx.currentSiteId,
    correlationId: ctx.correlationId,
    eventName: ctx.eventName,
    eventId: ctx.eventId,
    reason: ctx.reason,
    timestamp: new Date().toISOString(),
  };
}
