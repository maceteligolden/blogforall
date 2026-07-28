"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { TokenExhaustionProvider } from "@/components/usage/token-exhaustion-provider";

/**
 * Shared providers for the signup onboarding wizard (create-site, plans, invite).
 * Dashboard routes have their own ToastProvider in dashboard/layout.tsx.
 */
export function OnboardingProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <TokenExhaustionProvider>{children}</TokenExhaustionProvider>
    </ToastProvider>
  );
}
