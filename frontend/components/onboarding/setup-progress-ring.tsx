"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { useToast } from "@/components/ui/toast";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { useStartWorkspaceSetupInterview } from "@/lib/onboarding/use-start-setup-interview";

function CircularProgress({ percent }: { percent: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-700" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}

export function SetupProgressRing() {
  const { toast } = useToast();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const { startWorkspaceSetupInterview } = useStartWorkspaceSetupInterview();
  const wasComplete = useRef(false);
  const sawIncomplete = useRef(false);

  const { data: progress } = useQuery({
    queryKey: ["onboarding", "setup-progress", currentSiteId],
    queryFn: () => OnboardingService.getSetupProgress(currentSiteId!),
    enabled: Boolean(currentSiteId),
    refetchInterval: open ? 15_000 : 60_000,
  });

  const incomplete = useMemo(() => progress?.items.filter((i) => !i.done) ?? [], [progress?.items]);

  useEffect(() => {
    if (!progress) return;
    if (!progress.complete) {
      sawIncomplete.current = true;
      wasComplete.current = false;
      return;
    }
    if (sawIncomplete.current && !wasComplete.current) {
      wasComplete.current = true;
      onboardingTracker.setupComplete({ workspace_id: currentSiteId ?? undefined });
      toast({
        variant: "success",
        title: "Workspace setup complete",
        description: "Your brand profile is ready — the progress indicator will hide.",
      });
    }
  }, [progress, currentSiteId, toast]);

  if (!currentSiteId || !progress || progress.complete) {
    return null;
  }

  const handleToggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) {
        onboardingTracker.setupChecklistOpened({
          workspace_id: currentSiteId,
          percent: progress.percent,
        });
      }
      return next;
    });
  };

  const handleContinue = async () => {
    setOpen(false);
    setStarting(true);
    try {
      await startWorkspaceSetupInterview(currentSiteId);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-gray-200 hover:bg-primary/20 animate-pulse hover:animate-none"
        aria-label={`Finish setup ${progress.percent}% complete`}
        title="Finish workspace setup"
      >
        <span className="relative flex items-center justify-center">
          <CircularProgress percent={progress.percent} />
          <span className="absolute text-[10px] font-semibold text-white">{progress.percent}</span>
        </span>
        <span className="hidden sm:inline text-xs font-medium text-white whitespace-nowrap">
          Finish setup · {progress.percent}%
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-800 bg-gray-900 p-3 shadow-2xl z-[10000]">
          <p className="text-sm font-medium text-white mb-1">Workspace setup</p>
          <p className="text-xs text-gray-500 mb-3">
            {progress.percent}% done — finish these so the AI knows your brand.
          </p>
          <ul className="space-y-1.5 mb-3">
            {progress.items.map((item) => (
              <li
                key={item.id}
                className={`text-xs flex items-center gap-2 ${item.done ? "text-green-400" : "text-gray-400"}`}
              >
                <span className="w-3 text-center">{item.done ? "✓" : "○"}</span>
                {item.label}
              </li>
            ))}
          </ul>
          {incomplete.length > 0 && <p className="text-[11px] text-gray-500 mb-2">Next up: {incomplete[0].label}</p>}
          <button
            type="button"
            onClick={() => void handleContinue()}
            disabled={starting}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {starting ? "Starting…" : "Continue with AI"}
          </button>
        </div>
      )}
    </div>
  );
}
