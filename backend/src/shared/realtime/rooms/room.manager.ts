import { injectable } from "tsyringe";
import type { Socket } from "socket.io";
import { SiteService } from "../../../modules/site/services/site.service";
import { logger } from "../../utils/logger";
import { REALTIME_LOG_CONTEXT } from "../realtime.constants";
import { realtimeMetrics } from "../observability/realtime.metrics";
import { realtimeLogFields } from "../observability/realtime-log.context";
import { getConnectionContext } from "../auth/socket-auth.middleware";
import { siteRoom } from "./room.names";
import type { RoomJoinAck } from "../realtime.types";

@injectable()
export class RoomManager {
  constructor(private readonly siteService: SiteService) {}

  async joinSiteRoom(socket: Socket, siteId: string): Promise<RoomJoinAck> {
    const ctx = getConnectionContext(socket);
    if (!ctx) {
      return { ok: false, code: "auth_required", message: "Not authenticated" };
    }

    const allowed = await this.siteService.hasSiteAccess(siteId, ctx.userId);
    if (!allowed) {
      realtimeMetrics.inc("realtime.room.rejects");
      logger.warn(
        "Socket room join rejected",
        realtimeLogFields({
          connectionId: ctx.connectionId,
          socketId: socket.id,
          userId: ctx.userId,
          siteId,
          reason: "forbidden",
        }),
        REALTIME_LOG_CONTEXT
      );
      return { ok: false, code: "forbidden", message: "No access to this workspace" };
    }

    const room = siteRoom(siteId);
    await socket.join(room);
    ctx.joinedSiteIds.add(siteId);
    realtimeMetrics.inc("realtime.room.joins");
    logger.info(
      "Socket joined site room",
      realtimeLogFields({
        connectionId: ctx.connectionId,
        socketId: socket.id,
        userId: ctx.userId,
        siteId,
        eventName: "room:join",
      }),
      REALTIME_LOG_CONTEXT
    );
    return { ok: true, room };
  }

  async leaveSiteRoom(socket: Socket, siteId: string): Promise<RoomJoinAck> {
    const ctx = getConnectionContext(socket);
    if (!ctx) {
      return { ok: false, code: "auth_required", message: "Not authenticated" };
    }
    const room = siteRoom(siteId);
    await socket.leave(room);
    ctx.joinedSiteIds.delete(siteId);
    logger.info(
      "Socket left site room",
      realtimeLogFields({
        connectionId: ctx.connectionId,
        socketId: socket.id,
        userId: ctx.userId,
        siteId,
        eventName: "room:leave",
      }),
      REALTIME_LOG_CONTEXT
    );
    return { ok: true, room };
  }
}
