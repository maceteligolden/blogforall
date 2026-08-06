"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useToast } from "@/components/ui/toast";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { SETUP_INTERVIEW_PENDING_KEY } from "@/lib/onboarding/brand-setup-items";

/**
 * Shared helper: open dashboard chat with the AI asking the next missing
 * brand-setup field (no manual Send).
 */
export function useStartWorkspaceSetupInterview() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { setThreadId, focusComposer, setSetupInterviewActive } = useOrchestrator();
  const inFlight = useRef(false);

  const startWorkspaceSetupInterview = useCallback(
    async (siteIdOverride?: string) => {
      const siteId = siteIdOverride ?? currentSiteId;
      if (!siteId || inFlight.current) return;
      inFlight.current = true;
      try {
        if (pathname !== "/dashboard") {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(SETUP_INTERVIEW_PENDING_KEY, siteId);
          }
          router.push("/dashboard");
          return;
        }

        const res = await OrchestratorService.startOnboardingInterview(siteId);
        void queryClient.invalidateQueries({ queryKey: ["onboarding", "setup-progress", siteId] });

        if (res.complete) {
          setSetupInterviewActive(false);
          toast({
            variant: "success",
            title: "Workspace setup complete",
            description: "Your brand profile is ready.",
          });
          return;
        }

        if (res.thread_id) {
          setThreadId(res.thread_id);
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId),
          });
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, res.thread_id),
          });
        }

        setSetupInterviewActive(true);
        onboardingTracker.setupChecklistOpened({
          workspace_id: siteId,
          percent: res.progress?.percent,
        });
        focusComposer();
        toast({
          variant: "info",
          title: "Setup interview ready",
          description: "Answer the question in the chat — one topic at a time.",
        });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Couldn't start setup interview. Try again.";
        toast({ variant: "error", description: message });
      } finally {
        inFlight.current = false;
      }
    },
    [currentSiteId, pathname, router, queryClient, toast, setThreadId, focusComposer, setSetupInterviewActive]
  );

  return { startWorkspaceSetupInterview };
}
