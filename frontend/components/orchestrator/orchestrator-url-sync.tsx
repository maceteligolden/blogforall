"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOrchestrator } from "./orchestrator-provider";

/**
 * Keeps orchestrator threadId in sync with ?thread= on /dashboard.
 */
export function OrchestratorUrlSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { threadId, setThreadId } = useOrchestrator();

  const onDashboard = pathname === "/dashboard";
  const urlThreadId = searchParams.get("thread");

  // URL → state (back/forward navigation, direct links)
  useEffect(() => {
    if (!onDashboard) return;
    if (urlThreadId !== threadId) {
      setThreadId(urlThreadId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL only when searchParams change
  }, [onDashboard, urlThreadId, setThreadId]);

  // state → URL (new thread created in chat, programmatic setThreadId)
  useEffect(() => {
    if (!onDashboard) return;
    if (threadId === urlThreadId || (!threadId && !urlThreadId)) return;
    const next = threadId ? `/dashboard?thread=${encodeURIComponent(threadId)}` : "/dashboard";
    router.replace(next, { scroll: false });
  }, [onDashboard, threadId, urlThreadId, router]);

  return null;
}
