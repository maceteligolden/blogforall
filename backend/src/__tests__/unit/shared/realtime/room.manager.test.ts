import { RoomManager } from "../../../../shared/realtime/rooms/room.manager";
import type { SiteService } from "../../../../modules/site/services/site.service";
import type { Socket } from "socket.io";
import type { ConnectionContext } from "../../../../shared/realtime/realtime.types";

function mockSocket(userId: string): Socket {
  const ctx: ConnectionContext = {
    connectionId: "c1",
    socketId: "sock1",
    userId,
    email: "u@example.com",
    connectedAt: new Date(),
    joinedSiteIds: new Set(),
  };
  return {
    id: "sock1",
    data: { connection: ctx },
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

describe("RoomManager", () => {
  it("joins site room when user has access", async () => {
    const siteService = {
      hasSiteAccess: jest.fn().mockResolvedValue(true),
    } as unknown as SiteService;
    const manager = new RoomManager(siteService);
    const socket = mockSocket("user-1");

    const result = await manager.joinSiteRoom(socket, "site-1");
    expect(result).toEqual({ ok: true, room: "site:site-1" });
    expect(socket.join).toHaveBeenCalledWith("site:site-1");
  });

  it("rejects join when user lacks access", async () => {
    const siteService = {
      hasSiteAccess: jest.fn().mockResolvedValue(false),
    } as unknown as SiteService;
    const manager = new RoomManager(siteService);
    const socket = mockSocket("user-1");

    const result = await manager.joinSiteRoom(socket, "site-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("forbidden");
    }
    expect(socket.join).not.toHaveBeenCalled();
  });
});
