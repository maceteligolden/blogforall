"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/protected-route";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { canVisitStage, signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { persistFirstPostWritingRequest } from "@/lib/writing/use-start-writing-thread";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";

function StrategistReadyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const advancing = useRef(false);

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const siteId = siteIdParam ?? wizardStatus?.site_id;

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage === "complete") {
      router.replace("/dashboard");
      return;
    }
    if (wizardStatus.stage === "invite" || wizardStatus.stage === "strategist_setup") {
      router.replace(signupWizardPath(wizardStatus));
      return;
    }
    if (wizardStatus.stage !== "strategist_ready") {
      if (!canVisitStage("strategist_ready", wizardStatus.stage)) {
        router.replace(signupWizardPath(wizardStatus));
      }
      return;
    }
    if (advancing.current) return;
    advancing.current = true;
    void OnboardingService.acknowledgeStrategistReady()
      .then(async (status) => {
        onboardingTracker.stepCompleted({ step: "strategist_ready" });
        if (siteId) {
          useAuthStore.getState().setCurrentSiteId(siteId);
          persistFirstPostWritingRequest();
        }
        queryClient.setQueryData(["onboarding", "signup-wizard"], status);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] }),
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES }),
        ]);
        router.replace(signupWizardPath(status));
      })
      .catch(() => {
        advancing.current = false;
      });
  }, [wizardStatus, siteId, queryClient, router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-gray-400">Continuing to invite teammates...</p>
    </div>
  );
}

export default function OnboardingReadyPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        }
      >
        <StrategistReadyContent />
      </Suspense>
    </ProtectedRoute>
  );
}
