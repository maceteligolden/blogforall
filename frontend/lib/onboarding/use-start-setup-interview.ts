"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { StrategicService } from "@/lib/api/services/strategic.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useToast } from "@/components/ui/toast";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { SETUP_INTERVIEW_PENDING_KEY } from "@/lib/onboarding/brand-setup-items";

/**
 * Open dashboard chat on orchestrator v2 with a Content Strategy kickoff.
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

        setSetupInterviewActive(false);
        const strategy = await StrategicService.getStrategy(siteId).catch(() => null);
        const generating = strategy?.generation_status === "generating";
        const kickoff = generating
          ? "Content Strategy is still generating from our website. When it's ready, read it back in spoken voice and ask if it sounds like us — one question at a time, like a colleague, not a form. Don't interview me field-by-field. After I confirm, suggest the first post and start the writing loop on that topic."
          : "Read back our Content Strategy in spoken voice and ask if this sounds like us. One question per turn — a take plus a choice, not a list of aspects. Propose HITL patches only for corrections I confirm. Don't interview me field-by-field. After I confirm, suggest a first post from Evergreen and start the writing loop: discuss, then research HITLs, then a background draft.";

        const res = await OrchestratorService.chat(siteId, kickoff, undefined, { sessionMode: "auto" });
        void queryClient.invalidateQueries({ queryKey: ["onboarding", "setup-progress", siteId] });

        if (res.thread_id) {
          setThreadId(res.thread_id);
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId),
          });
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, res.thread_id),
          });
        }

        onboardingTracker.setupChecklistOpened({
          workspace_id: siteId,
          percent: generating ? 40 : 80,
        });
        focusComposer();
        toast({
          variant: "info",
          title: generating ? "Strategy is generating" : "Does this sound like you?",
          description: generating
            ? "I'll read the strategy back in chat once generation finishes."
            : "I'll read the strategy back, then we can write the first post.",
        });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Couldn't start the strategy conversation. Try again.";
        toast({ variant: "error", description: message });
      } finally {
        inFlight.current = false;
      }
    },
    [currentSiteId, pathname, router, queryClient, toast, setThreadId, focusComposer, setSetupInterviewActive]
  );

  return { startWorkspaceSetupInterview };
}
