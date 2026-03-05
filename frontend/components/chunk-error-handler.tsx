"use client";

import { useEffect } from "react";

/**
 * Listens for ChunkLoadError (e.g. after deploy when old HTML references missing chunks,
 * or when JS is served with wrong MIME type). Triggers one full reload to fetch fresh chunks.
 */
export function ChunkErrorHandler({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = "blogforall_chunk_reload";
    const reload = () => {
      if (typeof window === "undefined") return;
      const tried = sessionStorage.getItem(key);
      if (tried === "1") {
        sessionStorage.removeItem(key);
        return;
      }
      sessionStorage.setItem(key, "1");
      window.location.reload();
    };

    const isChunkError = (message: string, filename?: string) => {
      const msg = message ?? "";
      return (
        msg.includes("Loading chunk") ||
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading CSS chunk") ||
        (msg.includes("Failed to fetch") && (filename ?? "").includes("_next/static"))
      );
    };

    const handleError = (event: ErrorEvent) => {
      if (isChunkError(event.message ?? "", event.filename)) {
        event.preventDefault();
        reload();
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message ?? String(event.reason ?? "");
      if (isChunkError(msg)) {
        event.preventDefault();
        reload();
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return <>{children}</>;
}
