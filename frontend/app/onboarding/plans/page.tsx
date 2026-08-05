"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PlanContinueButton, PlanSelectionGrid } from "@/components/billing/plan-selection-cards";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";

function PlansOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [error, setError] = useState("");

  const { data: wizardStatus, isLoading } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus || isLoading) return;
    if (wizardStatus.stage !== "plan_selection") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, isLoading, router, siteIdParam]);

  const continueMutation = useMutation({
    mutationFn: () => OnboardingService.completePlanSelection(),
    onSuccess: async () => {
      onboardingTracker.planSelected({ onboarding_type: "workspace_setup", plan_type: "free" });
      const siteId = siteIdParam ?? wizardStatus?.site_id;
      queryClient.setQueryData(["onboarding", "signup-wizard"], {
        stage: "invite",
        site_id: siteId,
      });
      router.push(siteId ? `/onboarding/invite?siteId=${encodeURIComponent(siteId)}` : "/onboarding/invite");
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not continue. Please try again.";
      setError(message);
    },
  });

  if (isLoading || !wizardStatus) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading plans...</p>
      </div>
    );
  }

  return (
    <AuthSplitLayout wide>
      <SignupWizardProgress stage="plan_selection" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-gray-400">
          Almost there — paid plans are coming soon. Continue on Free to finish setup.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
      )}

      <PlanSelectionGrid />

      <div className="mt-8 flex justify-center sm:justify-start">
        <PlanContinueButton onClick={() => continueMutation.mutate()} loading={continueMutation.isPending} />
      </div>
    </AuthSplitLayout>
  );
}

export default function OnboardingPlansPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        }
      >
        <PlansOnboardingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
