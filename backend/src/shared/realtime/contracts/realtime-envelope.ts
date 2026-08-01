import { z } from "zod";
import { randomUUID } from "crypto";
import type { EmitOptions } from "../realtime.types";

export const realtimeEnvelopeSchema = z.object({
  v: z.literal(1),
  eventId: z.string().uuid(),
  name: z.string().min(1).max(128),
  ts: z.string().datetime(),
  correlationId: z.string().min(1).max(128).optional(),
  siteId: z.string().min(1).max(64).optional(),
  payload: z.unknown(),
});

export type RealtimeEnvelope = z.infer<typeof realtimeEnvelopeSchema>;

export function buildRealtimeEnvelope(
  name: string,
  payload: unknown,
  options: EmitOptions = {}
): RealtimeEnvelope {
  const envelope: RealtimeEnvelope = {
    v: 1,
    eventId: options.eventId ?? randomUUID(),
    name,
    ts: options.ts ?? new Date().toISOString(),
    payload,
  };
  if (options.correlationId) {
    envelope.correlationId = options.correlationId;
  }
  if (options.siteId) {
    envelope.siteId = options.siteId;
  }
  return realtimeEnvelopeSchema.parse(envelope);
}
