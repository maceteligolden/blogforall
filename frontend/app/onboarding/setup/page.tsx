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
  startStrategistBootstrap,
  type StrategistProgress,
  type StrategistProgressStep,
  type StrategistStepStatus,
} from "@/lib/api/services/onboarding.service";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { useRealtimeEvent } from "@/lib/hooks/use-realtime-event";
import { useRealtimeStatus } from "@/lib/hooks/use-realtime-status";
import { REALTIME_EVENTS } from "@/lib/realtime";

const TIMEOUT_MS = 3 * 60 * 1000;
const POLL_WHEN_SOCKET_DOWN_MS = 2500;
const POLL_WHEN_SOCKET_UP_MS = 8000;
const REASSURING_COPY = "Ensuring we’re doing it right.";

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

const EMPTY_STEPS: StrategistProgressStep[] = [
  { id: "content_strategy", label: "Content strategy", status: "pending" },
  { id: "default_campaign", label: "Default campaign", status: "pending" },
  { id: "campaign_topics", label: "Campaign topics", status: "pending" },
];

const OPTIMISTIC_STEPS: StrategistProgressStep[] = [
  { id: "content_strategy", label: "Content strategy", status: "in_progress" },
  { id: "default_campaign", label: "Default campaign", status: "pending" },
  { id: "campaign_topics", label: "Campaign topics", status: "pending" },
];

function statusIcon(status: StrategistStepStatus) {
  if (status === "ready") return <CheckCircle2 className="h-5 w-5 text-green-400" aria-hidden />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-red-400" aria-hidden />;
  return <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />;
}

function GeneratingStep({ step }: { step: StrategistProgressStep }) {
  const label = STEP_COPY[step.id][step.status];
  const working = step.status === "in_progress" || step.status === "pending";
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
        step.status === "in_progress"
          ? "border-primary/40 bg-primary/10"
          : step.status === "ready"
            ? "border-gray-800 bg-gray-900/40"
            : working
              ? "border-gray-800 bg-gray-900/30"
              : "border-gray-800 bg-gray-900/20"
      }`}
    >
      <div className="mt-0.5">{statusIcon(step.status)}</div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            step.status === "in_progress"
              ? "text-white"
              : step.status === "ready"
                ? "text-gray-200"
                : working
                  ? "text-gray-300"
                  : "text-gray-500"
          }`}
        >
          {label}
        </p>
      </div>
    </li>
  );
}

function applyStep(
  previous: StrategistProgress | undefined,
  siteId: string,
  stepId: StrategistProgressStep["id"],
  status: StrategistStepStatus,
  error?: string
): StrategistProgress {
  const steps = (previous?.steps ?? EMPTY_STEPS).map((step) =>
    step.id === stepId ? { ...step, status, error: status === "failed" ? error : undefined } : step
  );
  return {
    site_id: siteId,
    steps,
    ready: steps.every((s) => s.status === "ready"),
    failed: steps.some((s) => s.status === "failed"),
  };
}

function StrategistSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const [bootstrapStarted, setBootstrapStarted] = useState(false);
  const realtimeStatus = useRealtimeStatus();
  const socketLive = realtimeStatus === "connected";

  useOnboardingDropoff("strategist_setup");

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const siteId = siteIdParam ?? wizardStatus?.site_id;
  const progressKey = ["onboarding", "strategist-progress", siteId] as const;

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

  const { data: progress } = useQuery({
    queryKey: progressKey,
    queryFn: () => OnboardingService.getStrategistProgress(siteId!),
    enabled: bootstrapStarted && Boolean(siteId) && wizardStatus?.stage === "strategist_setup",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.ready || data?.failed) return false;
      return socketLive ? POLL_WHEN_SOCKET_UP_MS : POLL_WHEN_SOCKET_DOWN_MS;
    },
  });

  useEffect(() => {
    if (!socketLive || !bootstrapStarted || !siteId || wizardStatus?.stage !== "strategist_setup") return;
    void queryClient.invalidateQueries({ queryKey: progressKey });
  }, [socketLive, bootstrapStarted, siteId, wizardStatus?.stage, queryClient]);

  useEffect(() => {
    if (!siteId || wizardStatus?.stage !== "strategist_setup") return;
    void startStrategistBootstrap(siteId)
      .then((next) => {
        queryClient.setQueryData(progressKey, next);
        setBootstrapStarted(true);
      })
      .catch(() => {
        setBootstrapStarted(true);
        void queryClient.invalidateQueries({ queryKey: progressKey });
      });
  }, [siteId, wizardStatus?.stage, queryClient]);

  useRealtimeEvent<{
    siteId: string;
    step: StrategistProgressStep["id"];
    status: StrategistStepStatus;
    error?: string;
  }>(REALTIME_EVENTS.SIGNUP_BOOTSTRAP_STEP, (envelope) => {
    const payload = envelope.payload;
    if (!payload || payload.siteId !== siteId) return;
    queryClient.setQueryData(progressKey, (prev: StrategistProgress | undefined) =>
      applyStep(prev, payload.siteId, payload.step, payload.status, payload.error)
    );
  });

  useRealtimeEvent<{ siteId: string }>(REALTIME_EVENTS.SIGNUP_BOOTSTRAP_COMPLETED, (envelope) => {
    if (envelope.payload?.siteId !== siteId) return;
    queryClient.setQueryData(progressKey, (prev: StrategistProgress | undefined) => ({
      site_id: siteId,
      steps: (prev?.steps ?? EMPTY_STEPS).map((step) => ({ ...step, status: "ready" as const, error: undefined })),
      ready: true,
      failed: false,
    }));
  });

  useRealtimeEvent<{ siteId: string; step?: string; error?: string }>(
    REALTIME_EVENTS.SIGNUP_BOOTSTRAP_FAILED,
    (envelope) => {
      if (envelope.payload?.siteId !== siteId) return;
      queryClient.setQueryData(progressKey, (prev: StrategistProgress | undefined) => ({
        site_id: siteId,
        steps: (prev?.steps ?? EMPTY_STEPS).map((step) =>
          step.status === "ready" ? step : { ...step, status: "failed" as const }
        ),
        ready: false,
        failed: true,
      }));
    }
  );

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
    mutationFn: () => startStrategistBootstrap(siteId!),
    onMutate: () => {
      setTimedOut(false);
      if (!siteId) return;
      queryClient.setQueryData(progressKey, {
        site_id: siteId,
        steps: OPTIMISTIC_STEPS,
        ready: false,
        failed: false,
      });
    },
    onSuccess: (next) => {
      setTimedOut(false);
      setBootstrapStarted(true);
      queryClient.setQueryData(progressKey, next);
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
    },
  });

  const steps = useMemo(() => {
    if (!progress) return OPTIMISTIC_STEPS;
    return progress.steps;
  }, [progress]);
  const showRetry = Boolean((progress?.failed || timedOut) && !retryMutation.isPending);

  if (wizardStatus && wizardStatus.stage !== "strategist_setup" && wizardStatus.stage !== "strategist_ready") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title={REASSURING_COPY}
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

      {showRetry ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-400">{REASSURING_COPY}</p>
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
            <p className="text-gray-400">{REASSURING_COPY}</p>
          </div>
        }
      >
        <StrategistSetupContent />
      </Suspense>
    </ProtectedRoute>
  );
}
