"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface AIPanelContextValue {
  isOpen: boolean;
  threadId: string | null;
  open: (options?: { threadId?: string | null }) => void;
  close: () => void;
  setThreadId: (threadId: string | null) => void;
}

const AIPanelContext = createContext<AIPanelContextValue | null>(null);

/**
 * Top-level provider for the global orchestrator panel. We keep just enough
 * state here to drive open/close + which thread is being viewed; the rest
 * (messages, sending, etc.) lives inside the panel itself so the rest of the
 * dashboard tree doesn't pay re-render cost for chat activity.
 */
export function AIPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const open = useCallback((options?: { threadId?: string | null }) => {
    if (options && Object.prototype.hasOwnProperty.call(options, "threadId")) {
      setThreadId(options.threadId ?? null);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo<AIPanelContextValue>(
    () => ({ isOpen, threadId, open, close, setThreadId }),
    [isOpen, threadId, open, close]
  );

  return <AIPanelContext.Provider value={value}>{children}</AIPanelContext.Provider>;
}

export function useAIPanel(): AIPanelContextValue {
  const ctx = useContext(AIPanelContext);
  if (!ctx) {
    throw new Error("useAIPanel must be used inside an AIPanelProvider");
  }
  return ctx;
}
