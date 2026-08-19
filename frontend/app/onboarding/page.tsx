"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { ProtectedRoute } from "@/components/protected-route";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";

function OnboardingRedirect() {
  const router = useRouter();

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    onboardingTracker.started({ onboarding_type: "workspace_setup" });
  }, []);

  useEffect(() => {
    if (!wizardStatus) return;
    router.replace(signupWizardPath(wizardStatus));
  }, [wizardStatus, router]);

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
