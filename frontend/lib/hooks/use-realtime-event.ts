"use client";

import { useEffect, useRef } from "react";
import { useRealtimeOptional } from "@/components/realtime/realtime-provider";
import type { RealtimeEnvelope, RealtimeEventHandler } from "@/lib/realtime";

/**
 * Subscribe to a realtime event. Handler identity can change; latest is used.
 */
export function useRealtimeEvent<T = unknown>(eventName: string, handler: RealtimeEventHandler<T>): void {
  const realtime = useRealtimeOptional();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!realtime) return;
    return realtime.client.on(eventName, (envelope: RealtimeEnvelope) => {
      handlerRef.current(envelope as RealtimeEnvelope<T>);
    });
  }, [realtime, eventName]);
}
