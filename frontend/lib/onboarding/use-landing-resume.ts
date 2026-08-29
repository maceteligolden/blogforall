"use client";

import { useQuery } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { LANDING_CTAS } from "@/lib/landing/landing-copy";
import { useAuthStore } from "@/lib/store/auth.store";
import { needsBetaApproval } from "@/lib/auth/beta-access";

export function useLandingResumeCta() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    enabled: isAuthenticated,
    retry: false,
  });

  if (!isAuthenticated) {
    return { href: "/auth/signup" as const, label: LANDING_CTAS.startFree };
  }
  if (!isLoading && data?.stage === "complete") {
    if (needsBetaApproval(user)) {
      return { href: "/auth/waiting" as const, label: LANDING_CTAS.waitingForAccess };
    }
    return { href: "/dashboard" as const, label: LANDING_CTAS.dashboard };
  }
  return { href: "/onboarding" as const, label: LANDING_CTAS.continueSetup };
}
