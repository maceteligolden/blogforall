"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { Button } from "@/components/ui/button";
import {
  OnboardingService,
  type StrategistProgressStep,
  type StrategistStepStatus,
} from "@/lib/api/services/onboarding.service";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";

const POLL_MS = 3500;
const TIMEOUT_MS = 3 * 60 * 1000;

const STEP_COPY: Record<StrategistProgressStep["id"], Record<StrategistStepStatus, string>> = {
  content_strategy: {
    pending: "Content strategy being generated",
    in_progress: "Content strategy being generated",
    ready: "Content strategy generated",
    failed: "Content strategy failed",
  },
  default_campaign: {
    pending: "Campaign being drafted",
    in_progress: "Campaign being drafted",
    ready: "Campaign drafted",
    failed: "Campaign draft failed",
  },
  campaign_topics: {
    pending: "Campaign topics being generated",
    in_progress: "Campaign topics being generated",
    ready: "Campaign topics generated",
    failed: "Campaign topics failed",
  },
};

function statusIcon(status: StrategistStepStatus) {
  if (status === "ready") return <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-red-400" aria-hidden />;
  if (status === "in_progress") return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />;
  return <span className="mt-0.5 h-5 w-5 rounded-full border border-gray-700" aria-hidden />;
}

function GeneratingStep({ step }: { step: StrategistProgressStep }) {
  const label = STEP_COPY[step.id][step.status];
  const active = step.status === "in_progress";
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
        active
          ? "border-primary/40 bg-primary/10"
          : step.status === "ready"
            ? "border-gray-800 bg-gray-900/40"
            : "border-gray-800 bg-gray-900/20"
      }`}
    >
      <div className="mt-0.5">{statusIcon(step.status)}</div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${active ? "text-white" : step.status === "ready" ? "text-gray-200" : "text-gray-500"}`}
        >
          {label}
        </p>
        {step.error ? <p className="mt-1 text-xs text-red-300">{step.error}</p> : null}
      </div>
    </li>
  );
}

function StrategistSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);

  useOnboardingDropoff("strategist_setup");

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const siteId = siteIdParam ?? wizardStatus?.site_id;

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage === "strategist_ready") {
      router.replace(signupWizardPath(wizardStatus));
      return;
    }
    if (wizardStatus.stage !== "strategist_setup") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const { data: progress, isLoading } = useQuery({
    queryKey: ["onboarding", "strategist-progress", siteId],
    queryFn: () => OnboardingService.getStrategistProgress(siteId!),
    enabled: Boolean(siteId) && wizardStatus?.stage === "strategist_setup",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.ready || data.failed) return false;
      return POLL_MS;
    },
  });

  useEffect(() => {
    if (!progress || progress.ready || progress.failed) return;
    const id = window.setInterval(() => {
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        setTimedOut(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [progress, startedAt]);

  useEffect(() => {
    if (!progress?.ready || !siteId) return;
    onboardingTracker.stepCompleted({ step: "strategist_setup" });
    queryClient.setQueryData(["onboarding", "signup-wizard"], {
      stage: "strategist_ready",
      site_id: siteId,
    });
    router.replace(`/onboarding/ready?siteId=${encodeURIComponent(siteId)}`);
  }, [progress?.ready, siteId, queryClient, router]);

  const retryMutation = useMutation({
    mutationFn: () => OnboardingService.retryStrategistProgress(siteId!),
    onSuccess: (next) => {
      setTimedOut(false);
      queryClient.setQueryData(["onboarding", "strategist-progress", siteId], next);
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "strategist-progress", siteId] });
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
    },
  });

  const steps = useMemo(
    () =>
      progress?.steps ?? [
        { id: "content_strategy" as const, label: "Content strategy", status: "pending" as const },
        { id: "default_campaign" as const, label: "Default campaign", status: "pending" as const },
        { id: "campaign_topics" as const, label: "Campaign topics", status: "pending" as const },
      ],
    [progress]
  );

  const headline =
    steps.find((s) => s.status === "in_progress" || s.status === "failed") ??
    steps.find((s) => s.status !== "ready") ??
    steps[0];
  const headlineCopy = headline ? STEP_COPY[headline.id][headline.status] : "Setting up your strategist";

  if (!wizardStatus || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Preparing your strategist…</p>
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title={headlineCopy}
        subtitle="Stay on this screen until setup finishes. You cannot enter the workspace yet."
      />

      <ol className="space-y-3">
        {steps.map((step) => (
          <GeneratingStep key={step.id} step={step} />
        ))}
      </ol>

      {retryMutation.isError ? (
        <p className="mt-4 text-sm text-red-300">Could not retry right now. Wait a moment and try again.</p>
      ) : null}

      {progress?.failed || timedOut ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-400">
            {progress?.failed
              ? "Something went wrong while generating. Retry to keep going — signup has to finish before you can use the app."
              : "This is taking longer than usual. You can keep waiting or retry."}
          </p>
          <Button
            type="button"
            className="w-full"
            disabled={!siteId || retryMutation.isPending}
            onClick={() => retryMutation.mutate()}
          >
            {retryMutation.isPending ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-xs text-gray-500">This usually takes under a minute. Leave this tab open.</p>
      )}
    </AuthSplitLayout>
  );
}

export default function OnboardingSetupPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        }
      >
        <StrategistSetupContent />
      </Suspense>
    </ProtectedRoute>
  );
}
