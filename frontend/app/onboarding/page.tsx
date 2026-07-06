"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { ProtectedRoute } from "@/components/protected-route";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";

function OnboardingRedirect() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const skipStarted = useRef(false);

  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
  });

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
    enabled: onboardingStatus !== undefined && !onboardingStatus?.requiresOnboarding,
  });

  const skipMutation = useMutation({
    mutationFn: () => OnboardingService.skip(),
    onSuccess: async () => {
      onboardingTracker.userOnboardingCompleted();
      await queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
      const status = await OnboardingService.getSignupWizardStatus();
      router.replace(signupWizardPath(status));
    },
    onError: async () => {
      try {
        const status = await OnboardingService.getSignupWizardStatus();
        router.replace(signupWizardPath(status));
      } catch {
        router.replace("/onboarding/create-site");
      }
    },
  });

  useEffect(() => {
    onboardingTracker.started({ onboarding_type: "workspace_setup" });
  }, []);

  useEffect(() => {
    if (onboardingStatus === undefined) {
      return;
    }

    if (onboardingStatus.requiresOnboarding) {
      if (!skipStarted.current) {
        skipStarted.current = true;
        skipMutation.mutate();
      }
      return;
    }

    if (wizardStatus) {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [onboardingStatus, wizardStatus, router, skipMutation]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <p className="text-gray-400">Setting up your account...</p>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingRedirect />
    </ProtectedRoute>
  );
}
