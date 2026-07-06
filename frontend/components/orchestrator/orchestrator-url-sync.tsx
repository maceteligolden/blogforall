"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOrchestrator } from "./orchestrator-provider";

/**
 * Keeps orchestrator threadId in sync with ?thread= on /dashboard.
 * When the URL query changes (e.g. Dashboard nav strips ?thread=), URL wins
 * so we do not fight stale in-memory threadId in the same render cycle.
 */
export function OrchestratorUrlSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { threadId, setThreadId } = useOrchestrator();

  const onDashboard = pathname === "/dashboard";
  const urlThreadId = searchParams.get("thread");
  const prevUrlThreadRef = useRef<string | null>(urlThreadId);

  useEffect(() => {
    if (!onDashboard) {
      prevUrlThreadRef.current = urlThreadId;
      return;
    }

    const urlChanged = prevUrlThreadRef.current !== urlThreadId;
    prevUrlThreadRef.current = urlThreadId;

    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b087c" },
      body: JSON.stringify({
        sessionId: "4b087c",
        runId: "post-fix",
        hypothesisId: "H1-unified-sync",
        location: "orchestrator-url-sync.tsx:sync",
        message: "unified thread sync",
        data: {
          urlThreadId,
          threadId,
          urlChanged,
          branch:
            urlChanged && urlThreadId !== threadId
              ? "url-wins"
              : threadId === urlThreadId || (!threadId && !urlThreadId)
                ? "noop"
                : "push-url",
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    if (urlChanged) {
      if (urlThreadId !== threadId) {
        setThreadId(urlThreadId);
      }
      return;
    }

    if (threadId === urlThreadId || (!threadId && !urlThreadId)) return;

    const next = threadId ? `/dashboard?thread=${encodeURIComponent(threadId)}` : "/dashboard";
    router.replace(next, { scroll: false });
  }, [onDashboard, urlThreadId, threadId, setThreadId, router]);

  return null;
}
