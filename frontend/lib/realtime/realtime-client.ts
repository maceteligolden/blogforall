import { io, type Socket } from "socket.io-client";
import { getRealtimeServerUrl, REALTIME_NAMESPACE, REALTIME_PATH } from "./realtime-config";
import { CLIENT_EVENTS } from "./realtime-event-names";
import type { RealtimeConnectionStatus, RealtimeEnvelope, RealtimeEventHandler, RoomJoinAck } from "./realtime-types";
import { getFreshAccessToken, readAccessToken } from "./token-bridge";

type StatusListener = (status: RealtimeConnectionStatus) => void;

/**
 * Transport-agnostic Socket.io wrapper. Feature code should use hooks/provider,
 * not import socket.io-client directly.
 */
export class RealtimeClient {
  private socket: Socket | null = null;
  private status: RealtimeConnectionStatus = "disconnected";
  private readonly handlers = new Map<string, Set<RealtimeEventHandler>>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly seenEventIds = new Set<string>();
  private activeSiteId: string | null = null;
  private intentionalDisconnect = false;

  getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  on<T = unknown>(eventName: string, handler: RealtimeEventHandler<T>): () => void {
    let set = this.handlers.get(eventName);
    if (!set) {
      set = new Set();
      this.handlers.set(eventName, set);
      this.socket?.on(eventName, this.createDispatcher(eventName));
    }
    set.add(handler as RealtimeEventHandler);
    return () => {
      set!.delete(handler as RealtimeEventHandler);
      if (set!.size === 0) {
        this.handlers.delete(eventName);
        this.socket?.off(eventName);
      }
    };
  }

  async connect(): Promise<void> {
    if (typeof window === "undefined") return;
    this.intentionalDisconnect = false;

    const token = await getFreshAccessToken();
    if (!token) {
      this.setStatus("disconnected");
      return;
    }

    if (this.socket?.connected) {
      this.socket.auth = { token };
      return;
    }

    this.setStatus("connecting");

    if (this.socket) {
      this.socket.auth = { token };
      this.socket.connect();
      return;
    }

    this.socket = io(`${getRealtimeServerUrl()}${REALTIME_NAMESPACE}`, {
      path: REALTIME_PATH,
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      autoConnect: true,
    });

    for (const eventName of this.handlers.keys()) {
      this.socket.on(eventName, this.createDispatcher(eventName));
    }

    this.socket.on("connect", () => {
      this.setStatus("connected");
      if (this.activeSiteId) {
        void this.joinSite(this.activeSiteId);
      }
    });

    this.socket.on("disconnect", () => {
      if (!this.intentionalDisconnect) {
        this.setStatus("connecting");
      } else {
        this.setStatus("disconnected");
      }
    });

    this.socket.on("connect_error", async () => {
      this.setStatus("connecting");
      const fresh = await getFreshAccessToken();
      if (this.socket && fresh) {
        this.socket.auth = { token: fresh };
      }
    });
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.activeSiteId = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  async updateAuthAndReconnect(): Promise<void> {
    const token = await getFreshAccessToken();
    if (!this.socket || !token) return;
    this.socket.auth = { token };
    if (!this.socket.connected) {
      this.socket.connect();
    } else {
      this.socket.disconnect();
      this.socket.connect();
    }
  }

  async joinSite(siteId: string): Promise<RoomJoinAck> {
    this.activeSiteId = siteId;
    if (!this.socket?.connected) {
      return { ok: false, code: "not_connected", message: "Socket not connected" };
    }
    return new Promise((resolve) => {
      this.socket!.emit(CLIENT_EVENTS.ROOM_JOIN, { siteId }, (ack: RoomJoinAck) => {
        resolve(ack ?? { ok: true });
      });
    });
  }

  async leaveSite(siteId: string): Promise<RoomJoinAck> {
    if (this.activeSiteId === siteId) {
      this.activeSiteId = null;
    }
    if (!this.socket?.connected) {
      return { ok: false, code: "not_connected", message: "Socket not connected" };
    }
    return new Promise((resolve) => {
      this.socket!.emit(CLIENT_EVENTS.ROOM_LEAVE, { siteId }, (ack: RoomJoinAck) => {
        resolve(ack ?? { ok: true });
      });
    });
  }

  /** Soft check used by provider before connect. */
  hasToken(): boolean {
    return Boolean(readAccessToken());
  }

  private createDispatcher(eventName: string) {
    return (envelope: RealtimeEnvelope) => {
      if (envelope?.eventId) {
        if (this.seenEventIds.has(envelope.eventId)) return;
        this.seenEventIds.add(envelope.eventId);
        if (this.seenEventIds.size > 500) {
          const first = this.seenEventIds.values().next().value as string;
          this.seenEventIds.delete(first);
        }
      }
      const set = this.handlers.get(eventName);
      if (!set) return;
      for (const handler of set) {
        try {
          handler(envelope);
        } catch {
          // Swallow handler errors to protect other subscribers.
        }
      }
    };
  }

  private setStatus(status: RealtimeConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

let singleton: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!singleton) {
    singleton = new RealtimeClient();
  }
  return singleton;
}
