"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { Button } from "@/components/ui/button";
import {
  OnboardingService,
  startStrategistBootstrap,
  type StrategistProgress,
  type StrategistProgressStep,
  type StrategistStepStatus,
} from "@/lib/api/services/onboarding.service";
import {
  canVisitStage,
  nextWizardPath,
  signupBootstrapRefreshKey,
  signupWizardPath,
} from "@/lib/onboarding/signup-wizard";
import { isWebsiteIngestFailure } from "@/lib/onboarding/website-ingest-failure";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { useRealtimeEvent } from "@/lib/hooks/use-realtime-event";
import { useRealtimeStatus } from "@/lib/hooks/use-realtime-status";
import { REALTIME_EVENTS } from "@/lib/realtime";
import { SETUP_INTERVIEW_PENDING_KEY } from "@/lib/onboarding/brand-setup-items";
import { useAuthStore } from "@/lib/store/auth.store";
import { useWizardTransition } from "@/lib/onboarding/use-wizard-transition";
import { WizardFormLoader } from "@/components/onboarding/wizard-form-loader";

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
  const failed = step.status === "failed";
  return (
    <li
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
        step.status === "in_progress"
          ? "border-primary/40 bg-primary/10"
          : step.status === "ready"
            ? "border-gray-800 bg-gray-900/40"
            : failed
              ? "border-red-800 bg-red-950/40"
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
                : failed
                  ? "text-red-200"
                  : working
                    ? "text-gray-300"
                    : "text-gray-500"
          }`}
        >
          {label}
        </p>
        {failed && step.error ? <p className="mt-1 text-xs text-red-300">{step.error}</p> : null}
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
  const advancingToInvite = useRef(false);
  const sawGenerating = useRef(false);
  const startRequested = useRef(false);
  const [refreshThisVisit] = useState(() => {
    const id = searchParams.get("siteId");
    return Boolean(id && sessionStorage.getItem(signupBootstrapRefreshKey(id)) === "1");
  });
  const { pending, begin, cancel, push } = useWizardTransition();
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
    if (!wizardStatus || refreshThisVisit) return;
    if (wizardStatus.stage !== "strategist_setup" && wizardStatus.stage !== "strategist_ready") {
      if (!canVisitStage("strategist_setup", wizardStatus.stage)) {
        router.replace(signupWizardPath(wizardStatus));
      }
    }
  }, [wizardStatus, router, refreshThisVisit]);

  const revisitingAfterReady =
    !refreshThisVisit && (wizardStatus?.stage === "invite" || wizardStatus?.stage === "strategist_ready");

  const { data: progress } = useQuery({
    queryKey: progressKey,
    queryFn: () => OnboardingService.getStrategistProgress(siteId!),
    enabled: Boolean(siteId) && (revisitingAfterReady || bootstrapStarted || refreshThisVisit),
    refetchInterval: (query) => {
      if (revisitingAfterReady) return false;
      const data = query.state.data;
      if (data?.ready || data?.failed) return false;
      return socketLive ? POLL_WHEN_SOCKET_UP_MS : POLL_WHEN_SOCKET_DOWN_MS;
    },
  });

  useEffect(() => {
    if (!socketLive || !bootstrapStarted || !siteId) return;
    if (!refreshThisVisit && wizardStatus?.stage !== "strategist_setup") return;
    void queryClient.invalidateQueries({ queryKey: progressKey });
  }, [socketLive, bootstrapStarted, siteId, wizardStatus?.stage, queryClient, refreshThisVisit]);

  useEffect(() => {
    if (!siteId || startRequested.current) return;
    const force = refreshThisVisit || sessionStorage.getItem(signupBootstrapRefreshKey(siteId)) === "1";
    if (!force && (wizardStatus?.stage === "invite" || wizardStatus?.stage === "strategist_ready")) {
      setBootstrapStarted(true);
      return;
    }
    if (!force && wizardStatus?.stage !== "strategist_setup") return;
    startRequested.current = true;
    if (force) sawGenerating.current = true;
    void startStrategistBootstrap(siteId, { force })
      .then((next) => {
        sessionStorage.removeItem(signupBootstrapRefreshKey(siteId));
        queryClient.setQueryData(progressKey, next);
        setBootstrapStarted(true);
      })
      .catch(() => {
        setBootstrapStarted(true);
        void queryClient.invalidateQueries({ queryKey: progressKey });
      });
  }, [siteId, wizardStatus?.stage, queryClient, refreshThisVisit]);

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
      const error = envelope.payload?.error;
      queryClient.setQueryData(progressKey, (prev: StrategistProgress | undefined) => ({
        site_id: siteId,
        steps: (prev?.steps ?? EMPTY_STEPS).map((step) =>
          step.status === "ready" ? step : { ...step, status: "failed" as const, error: step.error ?? error }
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
    if (progress && !progress.ready && !progress.failed) {
      sawGenerating.current = true;
    }
  }, [progress]);

  useEffect(() => {
    const firstCompletion =
      Boolean(siteId) &&
      sawGenerating.current &&
      Boolean(progress?.ready) &&
      (wizardStatus?.stage === "strategist_setup" || wizardStatus?.stage === "strategist_ready" || refreshThisVisit);
    if (!firstCompletion) return;
    if (!siteId) return;
    if (advancingToInvite.current) return;
    advancingToInvite.current = true;
    begin();
    onboardingTracker.stepCompleted({ step: "strategist_setup" });
    void OnboardingService.acknowledgeStrategistReady()
      .then(async (status) => {
        onboardingTracker.stepCompleted({ step: "strategist_ready" });
        useAuthStore.getState().setCurrentSiteId(siteId);
        sessionStorage.setItem(SETUP_INTERVIEW_PENDING_KEY, siteId);
        queryClient.setQueryData(["onboarding", "signup-wizard"], status);
        await queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
        push(signupWizardPath(status));
      })
      .catch(() => {
        advancingToInvite.current = false;
        cancel();
      });
  }, [progress?.ready, wizardStatus?.stage, siteId, queryClient, begin, cancel, push, refreshThisVisit]);

  const retryMutation = useMutation({
    mutationFn: () => startStrategistBootstrap(siteId!, { force: true }),
    onMutate: () => {
      setTimedOut(false);
      sawGenerating.current = true;
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
    if (!progress) {
      if (revisitingAfterReady) {
        return EMPTY_STEPS.map((step) => ({ ...step, status: "ready" as const }));
      }
      return OPTIMISTIC_STEPS;
    }
    return progress.steps;
  }, [progress, revisitingAfterReady]);
  const generationComplete =
    Boolean(progress?.ready) ||
    (!refreshThisVisit &&
      !progress?.failed &&
      (wizardStatus?.stage === "invite" || wizardStatus?.stage === "strategist_ready"));
  const urlFailed = Boolean(
    progress?.failed &&
    progress.steps.some((step) => step.id === "content_strategy" && isWebsiteIngestFailure(step.error))
  );
  const showRetry = Boolean((progress?.failed || timedOut) && !retryMutation.isPending);

  if (
    !refreshThisVisit &&
    wizardStatus &&
    wizardStatus.stage !== "strategist_setup" &&
    wizardStatus.stage !== "strategist_ready" &&
    !canVisitStage("strategist_setup", wizardStatus.stage)
  ) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title={generationComplete ? "Workspace setup is ready" : REASSURING_COPY}
        subtitle={
          generationComplete
            ? "Content strategy, campaign, and topics are in place. Continue when you're ready."
            : "Stay on this screen until setup finishes. You cannot enter the workspace yet."
        }
        clearSignupAttempt
      />
      <SignupWizardProgress stage="strategist_setup" siteId={siteId} />

      {pending ? (
        <WizardFormLoader />
      ) : (
        <>
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
              <p className="text-sm text-red-300">
                {urlFailed
                  ? "We couldn't read that website. Update the URL so we can generate your Content Strategy."
                  : timedOut
                    ? "This is taking longer than expected. Retry setup or update the website URL."
                    : progress?.steps.find((step) => step.status === "failed" && step.error)?.error ||
                      "Content strategy was not generated properly. Retry setup or update the website URL."}
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
          ) : generationComplete && wizardStatus ? (
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => {
                begin();
                push(nextWizardPath("strategist_setup", siteId));
              }}
            >
              Continue
            </Button>
          ) : (
            <p className="mt-6 text-xs text-gray-500">This usually takes under a minute. Leave this tab open.</p>
          )}
        </>
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
