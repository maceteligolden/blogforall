import { buildRealtimeEnvelope, realtimeEnvelopeSchema } from "../../../../shared/realtime/contracts/realtime-envelope";
import { userRoom, siteRoom, threadRoom } from "../../../../shared/realtime/rooms/room.names";
import { REALTIME_EVENTS } from "../../../../shared/realtime/contracts/event-names";
import { roomJoinSchema } from "../../../../shared/realtime/validators/client-inbound.schemas";
import { realtimeMetrics } from "../../../../shared/realtime/observability/realtime.metrics";

describe("realtime envelope", () => {
  it("builds a v1 envelope with eventId and timestamp", () => {
    const envelope = buildRealtimeEnvelope(REALTIME_EVENTS.NOTIFICATION_CREATED, { id: "n1" }, {
      correlationId: "c1",
      siteId: "s1",
    });
    expect(envelope.v).toBe(1);
    expect(envelope.name).toBe("notification.created");
    expect(envelope.payload).toEqual({ id: "n1" });
    expect(envelope.correlationId).toBe("c1");
    expect(envelope.siteId).toBe("s1");
    expect(realtimeEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });
});

describe("room names", () => {
  it("formats user, site, and thread rooms", () => {
    expect(userRoom("u1")).toBe("user:u1");
    expect(siteRoom("s1")).toBe("site:s1");
    expect(threadRoom("s1", "t1")).toBe("thread:s1:t1");
  });
});

describe("client inbound schemas", () => {
  it("accepts valid room:join payload", () => {
    expect(roomJoinSchema.safeParse({ siteId: "abc" }).success).toBe(true);
  });

  it("rejects empty siteId", () => {
    expect(roomJoinSchema.safeParse({ siteId: "" }).success).toBe(false);
  });
});

describe("realtime metrics", () => {
  beforeEach(() => {
    realtimeMetrics.resetForTests();
  });

  it("tracks counters and active connections", () => {
    realtimeMetrics.inc("realtime.events.emitted");
    realtimeMetrics.adjustActive(2);
    realtimeMetrics.adjustActive(-1);
    const snap = realtimeMetrics.snapshot();
    expect(snap["realtime.events.emitted"]).toBe(1);
    expect(snap["realtime.connections.active"]).toBe(1);
  });
});
