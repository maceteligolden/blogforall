"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { TokenExhaustionProvider } from "@/components/usage/token-exhaustion-provider";

/**
 * Shared providers for the signup onboarding wizard (create-site, plans, invite).
 * Dashboard routes have their own ToastProvider in dashboard/layout.tsx.
 */
export function OnboardingProviders({ children }: { children: ReactNode }) {
  // #region agent log
  if (typeof window !== "undefined") {
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b087c" },
      body: JSON.stringify({
        sessionId: "4b087c",
        hypothesisId: "A",
        location: "onboarding-providers.tsx:mount",
        message: "OnboardingProviders mounted with ToastProvider",
        data: { path: window.location.pathname },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  return (
    <ToastProvider>
      <TokenExhaustionProvider>{children}</TokenExhaustionProvider>
    </ToastProvider>
  );
}
