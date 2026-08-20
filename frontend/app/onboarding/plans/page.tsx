"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { PlanContinueButton, PlanSelectionList, isFreePlan } from "@/components/billing/plan-selection-cards";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { AddCardDialog } from "@/components/billing/add-card-dialog";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { usePlans } from "@/lib/hooks/use-subscription";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { canVisitStage, nextWizardPath, signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { useWizardTransition } from "@/lib/onboarding/use-wizard-transition";
import { WizardFormLoader } from "@/components/onboarding/wizard-form-loader";

function PlansOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [error, setError] = useState("");
  useOnboardingDropoff("plan_selection");
  const { pending, begin, cancel, push } = useWizardTransition();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [pendingPaymentMethodId, setPendingPaymentMethodId] = useState<string | null>(null);

  const { data: wizardStatus, isLoading: wizardLoading } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const { data: plans = [], isLoading: plansLoading } = usePlans();

  useEffect(() => {
    if (!wizardStatus || wizardLoading) return;
    if (wizardStatus.stage !== "plan_selection" && !canVisitStage("plan_selection", wizardStatus.stage)) {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, wizardLoading, router, siteIdParam]);

  useEffect(() => {
    if (!plans.length || selectedPlanId) return;
    const free = plans.find(isFreePlan);
    setSelectedPlanId(free?._id ?? plans[0]._id);
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(() => plans.find((p) => p._id === selectedPlanId), [plans, selectedPlanId]);

  const goWorkspace = (siteId?: string) => {
    queryClient.setQueryData(["onboarding", "signup-wizard"], {
      stage: wizardStatus && wizardStatus.stage !== "plan_selection" ? wizardStatus.stage : "workspace_name",
      site_id: siteId,
    });
    queryClient.setQueryData(["onboarding", "status"], {
      requiresOnboarding: false,
      hasCard: false,
      hasPlan: false,
    });
    onboardingTracker.stepCompleted({ step: "plan_selection" });
    push(nextWizardPath("plan_selection", siteId));
    void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding", "status"] });
  };

  const freeContinueMutation = useMutation({
    mutationFn: () => OnboardingService.completePlanSelection(),
    onSuccess: async () => {
      onboardingTracker.planSelected({ onboarding_type: "workspace_setup", plan_type: "free" });
      const siteId = siteIdParam ?? wizardStatus?.site_id;
      goWorkspace(siteId);
    },
    onError: (err: unknown) => {
      cancel();
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not continue. Please try again.";
      setError(message);
    },
  });

  const paidContinueMutation = useMutation({
    mutationFn: ({ planId, paymentMethodId }: { planId: string; paymentMethodId: string }) =>
      OnboardingService.complete(planId, paymentMethodId),
    onSuccess: async () => {
      onboardingTracker.planSelected({
        onboarding_type: "workspace_setup",
        plan_type: selectedPlan?.name ?? "paid",
      });
      const siteId = siteIdParam ?? wizardStatus?.site_id;
      goWorkspace(siteId);
    },
    onError: (err: unknown) => {
      cancel();
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not complete paid plan selection. Please try again.";
      setError(message);
    },
  });

  const handleContinue = () => {
    setError("");
    if (!selectedPlan) {
      setError("Select a plan to continue.");
      return;
    }
    begin();
    if (isFreePlan(selectedPlan)) {
      freeContinueMutation.mutate();
      return;
    }
    if (pendingPaymentMethodId) {
      paidContinueMutation.mutate({
        planId: selectedPlan._id,
        paymentMethodId: pendingPaymentMethodId,
      });
      return;
    }
    cancel();
    setAddCardOpen(true);
  };

  const loading =
    pending || wizardLoading || plansLoading || freeContinueMutation.isPending || paidContinueMutation.isPending;

  const ctaLabel =
    selectedPlan && isFreePlan(selectedPlan)
      ? "Continue with Free"
      : pendingPaymentMethodId
        ? "Continue with paid plan"
        : "Add card & continue";

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title="Choose your plan"
        subtitle="Start free or pick a paid plan. Paid plans require a card — you can change anytime from Subscription."
        clearSignupAttempt
      />
      <SignupWizardProgress stage="plan_selection" siteId={siteIdParam ?? wizardStatus?.site_id} />

      {wizardLoading || plansLoading || !wizardStatus || pending ? (
        <WizardFormLoader label={pending ? "Continuing…" : "Loading plans…"} />
      ) : (
        <>
      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
      )}

      {plans.length === 0 ? (
        <p className="text-sm text-gray-400">No plans available. Contact support.</p>
      ) : (
        <PlanSelectionList
          plans={plans}
          selectedId={selectedPlanId}
          onSelect={(id) => {
            setSelectedPlanId(id);
            setPendingPaymentMethodId(null);
          }}
        />
      )}

      {pendingPaymentMethodId && selectedPlan && !isFreePlan(selectedPlan) && (
        <p className="mt-4 text-xs text-green-400">Card ready — continue to activate {selectedPlan.name}.</p>
      )}

      <div className="mt-6">
        <PlanContinueButton onClick={handleContinue} loading={loading} disabled={!selectedPlanId} label={ctaLabel} />
      </div>
        </>
      )}

      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSuccess={(paymentMethodId) => {
          if (paymentMethodId && selectedPlan && !isFreePlan(selectedPlan)) {
            begin();
            setPendingPaymentMethodId(paymentMethodId);
            paidContinueMutation.mutate({
              planId: selectedPlan._id,
              paymentMethodId,
            });
          }
          setAddCardOpen(false);
        }}
      />
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
