export { REALTIME_EVENTS } from "./contracts/event-names";
export type { RealtimeEventName } from "./contracts/event-names";
export { buildRealtimeEnvelope, realtimeEnvelopeSchema } from "./contracts/realtime-envelope";
export type { RealtimeEnvelope } from "./contracts/realtime-envelope";
export { RealtimeService } from "./services/realtime.service";
export { SocketIoRealtimeGateway } from "./gateway/socketio.realtime.gateway";
export { RoomManager } from "./rooms/room.manager";
export { userRoom, siteRoom, threadRoom } from "./rooms/room.names";
export { realtimeMetrics } from "./observability/realtime.metrics";
export type { IRealtimeService, IRealtimeGateway } from "./interfaces/realtime.gateway.interface";
export type { EmitOptions, ConnectionContext } from "./realtime.types";
export {
  REALTIME_NAMESPACE,
  REALTIME_PATH,
  REALTIME_NAMESPACE_DEFAULT,
  REALTIME_PATH_DEFAULT,
  CLIENT_EVENTS,
  INFRA_EVENTS,
} from "./realtime.constants";
