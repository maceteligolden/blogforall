"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  WRITING_THREAD_PENDING_KEY,
  useStartWritingThread,
  type WritingThreadRequest,
} from "@/lib/writing/use-start-writing-thread";

export function WritingThreadBootstrap() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { startWritingThread } = useStartWritingThread();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    const raw = sessionStorage.getItem(WRITING_THREAD_PENDING_KEY);
    if (!raw) return;
    let req: WritingThreadRequest;
    try {
      req = JSON.parse(raw) as WritingThreadRequest;
    } catch {
      sessionStorage.removeItem(WRITING_THREAD_PENDING_KEY);
      return;
    }
    ran.current = true;
    sessionStorage.removeItem(WRITING_THREAD_PENDING_KEY);
    void startWritingThread({ ...req, stayOnPage: true }, currentSiteId ?? undefined);
  }, [currentSiteId, startWritingThread]);

  return null;
}
