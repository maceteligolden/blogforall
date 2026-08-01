import type { RealtimeEnvelope } from "../contracts/realtime-envelope";
import type { EmitOptions } from "../realtime.types";
import type { Server as HttpServer } from "http";

/**
 * Transport-facing gateway. Business code must not use this directly —
 * inject RealtimeService instead.
 */
export interface IRealtimeGateway {
  attach(httpServer: HttpServer): Promise<void>;
  close(): Promise<void>;
  isAttached(): boolean;
  emitToUser(userId: string, eventName: string, envelope: RealtimeEnvelope): void;
  emitToSite(siteId: string, eventName: string, envelope: RealtimeEnvelope): void;
  emitToConnection(socketId: string, eventName: string, envelope: RealtimeEnvelope): void;
  isUserConnected(userId: string): boolean;
  getConnectionCount(userId: string): number;
}

export interface IRealtimeService {
  emitToUser(userId: string, eventName: string, payload: unknown, options?: EmitOptions): void;
  emitToSite(siteId: string, eventName: string, payload: unknown, options?: EmitOptions): void;
  emitToConnection(socketId: string, eventName: string, payload: unknown, options?: EmitOptions): void;
  isUserConnected(userId: string): boolean;
}
