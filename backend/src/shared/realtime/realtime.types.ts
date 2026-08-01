export interface ConnectionContext {
  connectionId: string;
  socketId: string;
  userId: string;
  email: string;
  currentSiteId?: string;
  connectedAt: Date;
  /** Site rooms this socket has successfully joined. */
  joinedSiteIds: Set<string>;
}

export interface EmitMeta {
  correlationId?: string;
  siteId?: string;
  eventId?: string;
}

export interface EmitOptions extends EmitMeta {
  /** Override event timestamp (ISO). */
  ts?: string;
}

export interface RealtimeErrorPayload {
  code: string;
  message: string;
  correlationId?: string;
}

export type RoomJoinAck = { ok: true; room: string } | { ok: false; code: string; message: string };

export interface SocketAuthFailure {
  code: "auth_required" | "auth_invalid" | "auth_expired";
  message: string;
}
