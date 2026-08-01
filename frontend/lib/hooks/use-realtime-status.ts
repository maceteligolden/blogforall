"use client";

import { useEffect, useState } from "react";
import { useRealtimeOptional } from "@/components/realtime/realtime-provider";
import type { RealtimeConnectionStatus } from "@/lib/realtime";

export function useRealtimeStatus(): RealtimeConnectionStatus {
  const realtime = useRealtimeOptional();
  const [status, setStatus] = useState<RealtimeConnectionStatus>(realtime?.client.getStatus() ?? "disconnected");

  useEffect(() => {
    if (!realtime) {
      setStatus("disconnected");
      return;
    }
    return realtime.client.onStatus(setStatus);
  }, [realtime]);

  return status;
}
