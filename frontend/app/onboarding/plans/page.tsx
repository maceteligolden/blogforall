"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PlanContinueButton, PlanSelectionGrid, isFreePlan } from "@/components/billing/plan-selection-cards";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { AddCardDialog } from "@/components/billing/add-card-dialog";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { usePlans } from "@/lib/hooks/use-subscription";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";

function PlansOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;
  const [error, setError] = useState("");
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
    if (wizardStatus.stage !== "plan_selection") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, wizardLoading, router, siteIdParam]);

  useEffect(() => {
    if (!plans.length || selectedPlanId) return;
    const free = plans.find(isFreePlan);
    setSelectedPlanId(free?._id ?? plans[0]._id);
  }, [plans, selectedPlanId]);

  const selectedPlan = useMemo(() => plans.find((p) => p._id === selectedPlanId), [plans, selectedPlanId]);

  const goInvite = (siteId?: string) => {
    queryClient.setQueryData(["onboarding", "signup-wizard"], {
      stage: "invite",
      site_id: siteId,
    });
    // Plan selection marks onboarding_completed server-side; keep status cache in sync.
    queryClient.setQueryData(["onboarding", "status"], {
      requiresOnboarding: false,
      hasCard: false,
      hasPlan: false,
    });
    router.push(siteId ? `/onboarding/invite?siteId=${encodeURIComponent(siteId)}` : "/onboarding/invite");
    void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
    void queryClient.invalidateQueries({ queryKey: ["onboarding", "status"] });
  };

  const freeContinueMutation = useMutation({
    mutationFn: () => OnboardingService.completePlanSelection(),
    onSuccess: async () => {
      onboardingTracker.planSelected({ onboarding_type: "workspace_setup", plan_type: "free" });
      const siteId = siteIdParam ?? wizardStatus?.site_id;
      goInvite(siteId);
    },
    onError: (err: unknown) => {
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
      goInvite(siteId);
    },
    onError: (err: unknown) => {
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
    setAddCardOpen(true);
  };

  const loading = wizardLoading || plansLoading || freeContinueMutation.isPending || paidContinueMutation.isPending;

  if (wizardLoading || plansLoading || !wizardStatus) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-400">Loading plans...</p>
      </div>
    );
  }

  const ctaLabel =
    selectedPlan && isFreePlan(selectedPlan)
      ? "Continue with Free"
      : pendingPaymentMethodId
        ? "Continue with paid plan"
        : "Add card & continue";

  return (
    <AuthSplitLayout wide>
      <SignupWizardProgress stage="plan_selection" />
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-gray-400">
          Start free or pick a paid plan. Paid plans require a card — you can change anytime from Subscription.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
      )}

      {plans.length === 0 ? (
        <p className="text-sm text-gray-400">No plans available. Contact support.</p>
      ) : (
        <PlanSelectionGrid
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

      <div className="mt-8 flex justify-center sm:justify-start">
        <PlanContinueButton onClick={handleContinue} loading={loading} disabled={!selectedPlanId} label={ctaLabel} />
      </div>

      <AddCardDialog
        open={addCardOpen}
        onOpenChange={setAddCardOpen}
        onSuccess={(paymentMethodId) => {
          if (paymentMethodId && selectedPlan && !isFreePlan(selectedPlan)) {
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
