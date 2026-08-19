"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { Button } from "@/components/ui/button";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { SETUP_INTERVIEW_PENDING_KEY } from "@/lib/onboarding/brand-setup-items";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";

function StrategistReadyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [error, setError] = useState("");

  useOnboardingDropoff("strategist_ready");

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
    if (wizardStatus.stage !== "strategist_ready" && wizardStatus.stage !== "strategist_setup") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const acknowledgeMutation = useMutation({
    mutationFn: () => OnboardingService.acknowledgeStrategistReady(),
    onSuccess: async (status) => {
      onboardingTracker.stepCompleted({ step: "strategist_ready" });
      onboardingTracker.userOnboardingCompleted();
      queryClient.setQueryData(["onboarding", "signup-wizard"], status);
      if (siteId) {
        useAuthStore.getState().setCurrentSiteId(siteId);
        sessionStorage.setItem(SETUP_INTERVIEW_PENDING_KEY, siteId);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES }),
      ]);
      router.push("/dashboard");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not finish setup. Please try again.";
      setError(message);
    },
  });

  if (!wizardStatus) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
        <Sparkles className="h-6 w-6 text-primary" aria-hidden />
      </div>
      <AuthPageHeader
        title="Your business strategist is ready to go"
        subtitle="Content strategy is generated, your campaign is drafted, and the first topics are ready. Open chat to hear the strategy back."
      />
      <SignupWizardProgress stage="strategist_ready" />

      {error ? (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <Button className="w-full" disabled={acknowledgeMutation.isPending} onClick={() => acknowledgeMutation.mutate()}>
        {acknowledgeMutation.isPending ? "Opening workspace…" : "Go to dashboard"}
      </Button>
    </AuthSplitLayout>
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
