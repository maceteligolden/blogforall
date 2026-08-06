"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { useStartWorkspaceSetupInterview } from "@/lib/onboarding/use-start-setup-interview";
import { SETUP_BANNER_DISMISSED_KEY } from "@/lib/onboarding/brand-setup-items";
import { Button } from "@/components/ui/button";

export function SetupProgressBanner() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { startWorkspaceSetupInterview } = useStartWorkspaceSetupInterview();
  const [dismissed, setDismissed] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !currentSiteId) {
      setDismissed(true);
      return;
    }
    setDismissed(sessionStorage.getItem(`${SETUP_BANNER_DISMISSED_KEY}:${currentSiteId}`) === "1");
  }, [currentSiteId]);

  const { data: progress } = useQuery({
    queryKey: ["onboarding", "setup-progress", currentSiteId],
    queryFn: () => OnboardingService.getSetupProgress(currentSiteId!),
    enabled: Boolean(currentSiteId),
    refetchInterval: 60_000,
  });

  if (!currentSiteId || !progress || progress.complete || dismissed) {
    return null;
  }

  const dismiss = () => {
    sessionStorage.setItem(`${SETUP_BANNER_DISMISSED_KEY}:${currentSiteId}`, "1");
    setDismissed(true);
  };

  const continueSetup = async () => {
    setStarting(true);
    try {
      await startWorkspaceSetupInterview(currentSiteId);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-primary/30 bg-primary/10 px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">Finish brand setup · {progress.percent}%</p>
        <p className="text-xs text-gray-400">
          Tell Bloggr about your business so it can write in your voice — about 2 minutes.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          size="sm"
          className="bg-primary hover:bg-primary/90"
          disabled={starting}
          onClick={() => void continueSetup()}
        >
          {starting ? "Starting…" : "Continue with AI"}
        </Button>
        <button type="button" onClick={dismiss} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1">
          Dismiss
        </button>
      </div>
    </div>
  );
}
