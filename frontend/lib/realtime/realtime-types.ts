export type RealtimeConnectionStatus = "disconnected" | "connecting" | "connected";

export interface RealtimeEnvelope<T = unknown> {
  v: 1;
  eventId: string;
  name: string;
  ts: string;
  correlationId?: string;
  siteId?: string;
  payload: T;
}

export type RealtimeEventHandler<T = unknown> = (envelope: RealtimeEnvelope<T>) => void;

export interface RoomJoinAck {
  ok: boolean;
  room?: string;
  code?: string;
  message?: string;
}
