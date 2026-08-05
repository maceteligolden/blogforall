"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { useStartWorkspaceSetupInterview } from "@/lib/onboarding/use-start-setup-interview";
import { SETUP_INTERVIEW_PENDING_KEY } from "@/lib/onboarding/brand-setup-items";

/** Consumes sessionStorage pending flag after navigate-to-dashboard for setup interview. */
export function SetupInterviewBootstrap() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { startWorkspaceSetupInterview } = useStartWorkspaceSetupInterview();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || typeof window === "undefined") return;
    const pending = sessionStorage.getItem(SETUP_INTERVIEW_PENDING_KEY);
    if (!pending) return;
    if (currentSiteId && pending !== currentSiteId) {
      // Wait until site context matches the workspace that queued the interview.
      return;
    }
    ran.current = true;
    sessionStorage.removeItem(SETUP_INTERVIEW_PENDING_KEY);
    void startWorkspaceSetupInterview(pending);
  }, [currentSiteId, startWorkspaceSetupInterview]);

  return null;
}
