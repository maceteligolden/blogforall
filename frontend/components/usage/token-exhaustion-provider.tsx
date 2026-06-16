"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { parseTokenLimitError } from "@/lib/utils/token-limit-error";
import { TokenExhaustionModal } from "./token-exhaustion-modal";

interface TokenExhaustionContextValue {
  showFromError: (error: unknown) => boolean;
  show: (resetAt: string | null, message?: string) => void;
  close: () => void;
}

const TokenExhaustionContext = createContext<TokenExhaustionContextValue | null>(null);

export function TokenExhaustionProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>();

  const close = useCallback(() => setOpen(false), []);

  const show = useCallback((at: string | null, msg?: string) => {
    setResetAt(at);
    setMessage(msg);
    setOpen(true);
  }, []);

  const showFromError = useCallback(
    (error: unknown) => {
      const info = parseTokenLimitError(error);
      if (!info) return false;
      show(info.resetAt, info.message);
      return true;
    },
    [show]
  );

  const value = useMemo(
    () => ({ showFromError, show, close }),
    [showFromError, show, close]
  );

  return (
    <TokenExhaustionContext.Provider value={value}>
      {children}
      <TokenExhaustionModal
        isOpen={open}
        onClose={close}
        resetAt={resetAt}
        message={message}
      />
    </TokenExhaustionContext.Provider>
  );
}

export function useTokenExhaustion(): TokenExhaustionContextValue {
  const ctx = useContext(TokenExhaustionContext);
  if (!ctx) {
    throw new Error("useTokenExhaustion must be used within TokenExhaustionProvider");
  }
  return ctx;
}
