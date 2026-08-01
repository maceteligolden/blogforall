import { injectable } from "tsyringe";
import { logger } from "../../utils/logger";
import { REALTIME_LOG_CONTEXT } from "../realtime.constants";
import { buildRealtimeEnvelope } from "../contracts/realtime-envelope";
import type { IRealtimeService } from "../interfaces/realtime.gateway.interface";
import type { EmitOptions } from "../realtime.types";
import { SocketIoRealtimeGateway } from "../gateway/socketio.realtime.gateway";
import { realtimeLogFields } from "../observability/realtime-log.context";

/**
 * Business-facing realtime facade. Modules inject this — never Socket.io.
 */
@injectable()
export class RealtimeService implements IRealtimeService {
  constructor(private readonly gateway: SocketIoRealtimeGateway) {}

  emitToUser(userId: string, eventName: string, payload: unknown, options: EmitOptions = {}): void {
    try {
      const envelope = buildRealtimeEnvelope(eventName, payload, options);
      this.gateway.emitToUser(userId, eventName, envelope);
    } catch (err) {
      logger.error(
        "Realtime emitToUser failed",
        err instanceof Error ? err : new Error(String(err)),
        realtimeLogFields({ userId, eventName, correlationId: options.correlationId, siteId: options.siteId }),
        REALTIME_LOG_CONTEXT
      );
    }
  }

  emitToSite(siteId: string, eventName: string, payload: unknown, options: EmitOptions = {}): void {
    try {
      const envelope = buildRealtimeEnvelope(eventName, payload, { ...options, siteId: options.siteId ?? siteId });
      this.gateway.emitToSite(siteId, eventName, envelope);
    } catch (err) {
      logger.error(
        "Realtime emitToSite failed",
        err instanceof Error ? err : new Error(String(err)),
        realtimeLogFields({ siteId, eventName, correlationId: options.correlationId }),
        REALTIME_LOG_CONTEXT
      );
    }
  }

  emitToConnection(socketId: string, eventName: string, payload: unknown, options: EmitOptions = {}): void {
    try {
      const envelope = buildRealtimeEnvelope(eventName, payload, options);
      this.gateway.emitToConnection(socketId, eventName, envelope);
    } catch (err) {
      logger.error(
        "Realtime emitToConnection failed",
        err instanceof Error ? err : new Error(String(err)),
        realtimeLogFields({ socketId, eventName, correlationId: options.correlationId, siteId: options.siteId }),
        REALTIME_LOG_CONTEXT
      );
    }
  }

  isUserConnected(userId: string): boolean {
    return this.gateway.isUserConnected(userId);
  }
}
