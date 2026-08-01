import { RealtimeService } from "../../../../shared/realtime/services/realtime.service";
import type { SocketIoRealtimeGateway } from "../../../../shared/realtime/gateway/socketio.realtime.gateway";
import { REALTIME_EVENTS } from "../../../../shared/realtime/contracts/event-names";

describe("RealtimeService", () => {
  it("delegates emitToUser to gateway with a valid envelope", () => {
    const emitToUser = jest.fn();
    const gateway = {
      emitToUser,
      emitToSite: jest.fn(),
      emitToConnection: jest.fn(),
      isUserConnected: jest.fn().mockReturnValue(true),
    } as unknown as SocketIoRealtimeGateway;

    const service = new RealtimeService(gateway);
    service.emitToUser(
      "user-1",
      REALTIME_EVENTS.NOTIFICATION_CREATED,
      { id: "n1" },
      {
        correlationId: "corr-1",
      }
    );

    expect(emitToUser).toHaveBeenCalledTimes(1);
    const [userId, eventName, envelope] = emitToUser.mock.calls[0];
    expect(userId).toBe("user-1");
    expect(eventName).toBe("notification.created");
    expect(envelope.v).toBe(1);
    expect(envelope.payload).toEqual({ id: "n1" });
    expect(envelope.correlationId).toBe("corr-1");
  });

  it("does not throw when gateway emit fails", () => {
    const gateway = {
      emitToUser: jest.fn(() => {
        throw new Error("boom");
      }),
      emitToSite: jest.fn(),
      emitToConnection: jest.fn(),
      isUserConnected: jest.fn(),
    } as unknown as SocketIoRealtimeGateway;

    const service = new RealtimeService(gateway);
    expect(() => service.emitToUser("u", "x.y", {})).not.toThrow();
  });
});
