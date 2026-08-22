"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { claimWritingThreadRequest, useStartWritingThread } from "@/lib/writing/use-start-writing-thread";

export function WritingThreadBootstrap() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { startWritingThread } = useStartWritingThread();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    const req = claimWritingThreadRequest(currentSiteId ?? undefined);
    if (!req) return;
    ran.current = true;
    void startWritingThread({ ...req, stayOnPage: true }, currentSiteId ?? undefined);
  }, [currentSiteId, startWritingThread]);

  return null;
}
