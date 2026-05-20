"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { SiteService } from "@/lib/api/services/site.service";
import { ProtectedRoute } from "@/components/protected-route";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";

async function resolvePostOnboardingPath(): Promise<string> {
  try {
    const sites = await SiteService.getSites();
    const siteList = Array.isArray(sites) ? sites : [];
    if (siteList.length === 0) {
      return "/onboarding/create-site";
    }
    if (siteList.some((s) => s.status === "onboarding")) {
      return "/onboarding/create-site?step=chat";
    }
    return "/dashboard";
  } catch {
    return "/onboarding/create-site";
  }
}

function OnboardingRedirect() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const skipStarted = useRef(false);

  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
  });

  const skipMutation = useMutation({
    mutationFn: () => OnboardingService.skip(),
    onSuccess: async () => {
      onboardingTracker.userOnboardingCompleted();
      queryClient.invalidateQueries();
      const path = await resolvePostOnboardingPath();
      router.replace(path);
    },
    onError: async () => {
      const path = await resolvePostOnboardingPath();
      router.replace(path);
    },
  });

  useEffect(() => {
    onboardingTracker.started({ onboarding_type: "workspace_setup" });
  }, []);

  useEffect(() => {
    if (onboardingStatus === undefined) {
      return;
    }

    if (!onboardingStatus.requiresOnboarding) {
      void resolvePostOnboardingPath().then((path) => router.replace(path));
      return;
    }

    if (!skipStarted.current) {
      skipStarted.current = true;
      skipMutation.mutate();
    }
  }, [onboardingStatus, router, skipMutation]);

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
