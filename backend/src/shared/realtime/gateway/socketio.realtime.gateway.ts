import { injectable } from "tsyringe";
import { Server as HttpServer } from "http";
import { Server, Namespace, type Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import {
  CLIENT_EVENTS,
  INFRA_EVENTS,
  REALTIME_LOG_CONTEXT,
  REALTIME_MAX_CONNECTIONS_PER_USER_DEFAULT,
  REALTIME_NAMESPACE_DEFAULT,
  REALTIME_PATH_DEFAULT,
  REALTIME_REDIS_KEY_PREFIX,
} from "../realtime.constants";
import type { IRealtimeGateway } from "../interfaces/realtime.gateway.interface";
import type { RealtimeEnvelope } from "../contracts/realtime-envelope";
import { buildRealtimeEnvelope } from "../contracts/realtime-envelope";
import { socketAuthMiddleware, getConnectionContext } from "../auth/socket-auth.middleware";
import { RoomManager } from "../rooms/room.manager";
import { userRoom, siteRoom } from "../rooms/room.names";
import { roomJoinSchema, roomLeaveSchema } from "../validators/client-inbound.schemas";
import { assertSocketInboundRateLimit } from "../middleware/socket-rate-limit.middleware";
import { assertSocketPayloadSafe } from "../middleware/socket-payload-guard.middleware";
import { realtimeMetrics } from "../observability/realtime.metrics";
import { realtimeLogFields } from "../observability/realtime-log.context";
import type { ConnectionContext, RoomJoinAck } from "../realtime.types";

@injectable()
export class SocketIoRealtimeGateway implements IRealtimeGateway {
  private io: Server | null = null;
  private nsp: Namespace | null = null;
  private redisClients: Redis[] = [];
  /** Local registry for connection limits and isUserConnected (single-instance accurate). */
  private readonly connectionsByUser = new Map<string, Set<string>>();
  private readonly socketMeta = new Map<string, ConnectionContext>();

  constructor(private readonly roomManager: RoomManager) {}

  isAttached(): boolean {
    return this.io !== null && this.nsp !== null;
  }

  async attach(httpServer: HttpServer): Promise<void> {
    if (!env.realtime?.enabled) {
      logger.info("Realtime disabled (REALTIME_ENABLED=false)", {}, REALTIME_LOG_CONTEXT);
      return;
    }
    if (this.io) {
      logger.warn("Realtime gateway already attached", {}, REALTIME_LOG_CONTEXT);
      return;
    }

    const allowedOrigins =
      env.frontend.urls.length > 0 ? env.frontend.urls : [env.frontend.baseUrl];

    const path = env.realtime?.path || REALTIME_PATH_DEFAULT;
    const namespace = env.realtime?.namespace || REALTIME_NAMESPACE_DEFAULT;
    const maxConnections =
      env.realtime?.maxConnectionsPerUser || REALTIME_MAX_CONNECTIONS_PER_USER_DEFAULT;

    this.io = new Server(httpServer, {
      path,
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
      pingInterval: env.realtime?.pingIntervalMs ?? 25_000,
      pingTimeout: env.realtime?.pingTimeoutMs ?? 20_000,
      maxHttpBufferSize: env.realtime?.maxHttpBufferSize ?? 1_048_576,
      transports: ["websocket", "polling"],
    });

    await this.maybeAttachRedisAdapter();

    this.nsp = this.io.of(namespace);
    this.nsp.use(socketAuthMiddleware);
    this.nsp.on("connection", (socket) => this.onConnection(socket, maxConnections));

    logger.info(
      "Realtime gateway attached",
      {
        path,
        namespace,
        redisAdapter: env.realtime?.redisAdapterEnabled && Boolean(env.notification.redisUrl),
      },
      REALTIME_LOG_CONTEXT
    );
  }

  async close(): Promise<void> {
    if (this.nsp) {
      this.nsp.removeAllListeners();
      for (const socket of this.nsp.sockets.values()) {
        socket.disconnect(true);
      }
    }
    if (this.io) {
      await new Promise<void>((resolve) => {
        this.io!.close(() => resolve());
      });
    }
    this.io = null;
    this.nsp = null;
    this.connectionsByUser.clear();
    this.socketMeta.clear();
    realtimeMetrics.setActive(0);

    await Promise.all(
      this.redisClients.map(
        (client) =>
          new Promise<void>((resolve) => {
            client.quit().then(() => resolve()).catch(() => resolve());
          })
      )
    );
    this.redisClients = [];
    logger.info("Realtime gateway closed", {}, REALTIME_LOG_CONTEXT);
  }

  emitToUser(userId: string, eventName: string, envelope: RealtimeEnvelope): void {
    if (!this.nsp) return;
    const started = Date.now();
    this.nsp.to(userRoom(userId)).emit(eventName, envelope);
    realtimeMetrics.inc("realtime.events.emitted");
    realtimeMetrics.observeDuration("realtime.emit.duration_ms", Date.now() - started);
    logger.info(
      "Realtime emit to user",
      realtimeLogFields({
        userId,
        eventName,
        eventId: envelope.eventId,
        correlationId: envelope.correlationId,
        siteId: envelope.siteId,
      }),
      REALTIME_LOG_CONTEXT
    );
  }

  emitToSite(siteId: string, eventName: string, envelope: RealtimeEnvelope): void {
    if (!this.nsp) return;
    const started = Date.now();
    this.nsp.to(siteRoom(siteId)).emit(eventName, envelope);
    realtimeMetrics.inc("realtime.events.emitted");
    realtimeMetrics.observeDuration("realtime.emit.duration_ms", Date.now() - started);
    logger.info(
      "Realtime emit to site",
      realtimeLogFields({
        siteId,
        eventName,
        eventId: envelope.eventId,
        correlationId: envelope.correlationId,
      }),
      REALTIME_LOG_CONTEXT
    );
  }

  emitToConnection(socketId: string, eventName: string, envelope: RealtimeEnvelope): void {
    if (!this.nsp) return;
    const started = Date.now();
    this.nsp.to(socketId).emit(eventName, envelope);
    realtimeMetrics.inc("realtime.events.emitted");
    realtimeMetrics.observeDuration("realtime.emit.duration_ms", Date.now() - started);
    logger.info(
      "Realtime emit to connection",
      realtimeLogFields({
        socketId,
        eventName,
        eventId: envelope.eventId,
        correlationId: envelope.correlationId,
        siteId: envelope.siteId,
      }),
      REALTIME_LOG_CONTEXT
    );
  }

  isUserConnected(userId: string): boolean {
    return this.getConnectionCount(userId) > 0;
  }

  getConnectionCount(userId: string): number {
    return this.connectionsByUser.get(userId)?.size ?? 0;
  }

  /** Exposed for metrics/tests. */
  getMetricsSnapshot(): Record<string, number> {
    return realtimeMetrics.snapshot();
  }

  private async maybeAttachRedisAdapter(): Promise<void> {
    if (!env.realtime?.redisAdapterEnabled) return;
    const redisUrl = env.notification.redisUrl;
    if (!redisUrl) {
      logger.warn(
        "REALTIME_REDIS_ADAPTER_ENABLED but REDIS_URL missing; skipping adapter",
        {},
        REALTIME_LOG_CONTEXT
      );
      return;
    }
    try {
      const pubClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      const subClient = pubClient.duplicate();
      this.redisClients.push(pubClient, subClient);
      this.io!.adapter(
        createAdapter(pubClient, subClient, {
          key: REALTIME_REDIS_KEY_PREFIX.replace(/:$/, ""),
        })
      );
      logger.info("Socket.io Redis adapter attached", { keyPrefix: REALTIME_REDIS_KEY_PREFIX }, REALTIME_LOG_CONTEXT);
    } catch (err) {
      logger.error(
        "Failed to attach Socket.io Redis adapter",
        err instanceof Error ? err : new Error(String(err)),
        {},
        REALTIME_LOG_CONTEXT
      );
    }
  }

  private onConnection(socket: Socket, maxConnections: number): void {
    const ctx = getConnectionContext(socket);
    if (!ctx) {
      socket.disconnect(true);
      return;
    }

    this.enforceConnectionLimit(ctx.userId, socket, maxConnections);
    this.registerSocket(ctx);

    void socket.join(userRoom(ctx.userId));

    realtimeMetrics.inc("realtime.connections.opened");
    realtimeMetrics.adjustActive(1);

    logger.info(
      "Socket connected",
      realtimeLogFields({
        connectionId: ctx.connectionId,
        socketId: socket.id,
        userId: ctx.userId,
        siteId: ctx.currentSiteId,
      }),
      REALTIME_LOG_CONTEXT
    );

    socket.emit(
      INFRA_EVENTS.CONNECTED,
      buildRealtimeEnvelope(INFRA_EVENTS.CONNECTED, {
        connectionId: ctx.connectionId,
        userId: ctx.userId,
      })
    );

    socket.on(CLIENT_EVENTS.ROOM_JOIN, (raw, ack?: (res: RoomJoinAck) => void) => {
      void this.handleRoomJoin(socket, raw, ack);
    });
    socket.on(CLIENT_EVENTS.ROOM_LEAVE, (raw, ack?: (res: RoomJoinAck) => void) => {
      void this.handleRoomLeave(socket, raw, ack);
    });

    socket.on("disconnect", (reason) => {
      this.deregisterSocket(socket, reason);
    });
  }

  private enforceConnectionLimit(userId: string, incoming: Socket, maxConnections: number): void {
    const existing = this.connectionsByUser.get(userId);
    if (!existing || existing.size < maxConnections) return;

    const oldestSocketId = existing.values().next().value as string | undefined;
    if (!oldestSocketId || !this.nsp) return;

    const oldest = this.nsp.sockets.get(oldestSocketId);
    if (oldest) {
      realtimeMetrics.inc("realtime.connections.rejected_limit");
      logger.info(
        "Dropping oldest socket due to connection limit",
        realtimeLogFields({
          userId,
          socketId: oldestSocketId,
          reason: "connection_limit",
        }),
        REALTIME_LOG_CONTEXT
      );
      oldest.emit(
        INFRA_EVENTS.ERROR,
        buildRealtimeEnvelope(INFRA_EVENTS.ERROR, {
          code: "connection_limit",
          message: "Connection limit exceeded; older session disconnected",
        })
      );
      oldest.disconnect(true);
    }
    // Ensure incoming still registers even if oldest already gone
    void incoming;
  }

  private registerSocket(ctx: ConnectionContext): void {
    let set = this.connectionsByUser.get(ctx.userId);
    if (!set) {
      set = new Set();
      this.connectionsByUser.set(ctx.userId, set);
    }
    set.add(ctx.socketId);
    this.socketMeta.set(ctx.socketId, ctx);
  }

  private deregisterSocket(socket: Socket, reason: string): void {
    const ctx = getConnectionContext(socket) ?? this.socketMeta.get(socket.id);
    if (ctx) {
      const set = this.connectionsByUser.get(ctx.userId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        this.connectionsByUser.delete(ctx.userId);
      }
      this.socketMeta.delete(socket.id);
      logger.info(
        "Socket disconnected",
        realtimeLogFields({
          connectionId: ctx.connectionId,
          socketId: socket.id,
          userId: ctx.userId,
          reason,
        }),
        REALTIME_LOG_CONTEXT
      );
    }
    realtimeMetrics.inc("realtime.connections.closed");
    realtimeMetrics.adjustActive(-1);
  }

  private async handleRoomJoin(
    socket: Socket,
    raw: unknown,
    ack?: (res: RoomJoinAck) => void
  ): Promise<void> {
    realtimeMetrics.inc("realtime.events.inbound");
    if (!assertSocketInboundRateLimit(socket) || !assertSocketPayloadSafe(socket, raw)) {
      ack?.({ ok: false, code: "rejected", message: "Request rejected" });
      return;
    }
    const parsed = roomJoinSchema.safeParse(raw);
    if (!parsed.success) {
      const res: RoomJoinAck = { ok: false, code: "validation_error", message: "Invalid room:join payload" };
      socket.emit(INFRA_EVENTS.ERROR, buildRealtimeEnvelope(INFRA_EVENTS.ERROR, res));
      ack?.(res);
      return;
    }
    const result = await this.roomManager.joinSiteRoom(socket, parsed.data.siteId);
    if (!result.ok) {
      socket.emit(
        INFRA_EVENTS.ERROR,
        buildRealtimeEnvelope(INFRA_EVENTS.ERROR, {
          code: result.code,
          message: result.message,
        })
      );
    }
    ack?.(result);
  }

  private async handleRoomLeave(
    socket: Socket,
    raw: unknown,
    ack?: (res: RoomJoinAck) => void
  ): Promise<void> {
    realtimeMetrics.inc("realtime.events.inbound");
    if (!assertSocketInboundRateLimit(socket) || !assertSocketPayloadSafe(socket, raw)) {
      ack?.({ ok: false, code: "rejected", message: "Request rejected" });
      return;
    }
    const parsed = roomLeaveSchema.safeParse(raw);
    if (!parsed.success) {
      const res: RoomJoinAck = { ok: false, code: "validation_error", message: "Invalid room:leave payload" };
      ack?.(res);
      return;
    }
    const result = await this.roomManager.leaveSiteRoom(socket, parsed.data.siteId);
    ack?.(result);
  }
}
