"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { useToast } from "@/components/ui/toast";

function CreateSitePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { abandonSignupAsync, isAbandoningSignup } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useOnboardingDropoff("workspace_details");

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage !== "workspace_name") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const { createSiteMutation } = useCreateSiteMutations({
    onError: (msg) => {
      // Already have a site from a prior bounce — resume wizard instead of dead-ending.
      if (msg.toLowerCase().includes("maximum number of sites")) {
        void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] }).then(async () => {
          const status = await OnboardingService.getSignupWizardStatus();
          queryClient.setQueryData(["onboarding", "signup-wizard"], status);
          if (status.stage !== "workspace_name") {
            router.replace(signupWizardPath(status));
            return;
          }
          setError(msg);
          toast({ variant: "error", description: msg });
        });
        return;
      }
      setError(msg);
      toast({ variant: "error", description: msg });
    },
    onSiteReady: (site) => {
      queryClient.setQueryData(["onboarding", "signup-wizard"], {
        stage: "plan_selection",
        site_id: site._id,
      });
      toast({
        variant: "success",
        title: "Workspace ready",
        description: `"${site.name}" is set up. Next, pick a plan.`,
      });
      router.push(`/onboarding/plans?siteId=${encodeURIComponent(site._id)}`);
    },
  });

  const nameError = nameTouched && !name.trim() ? "Give your workspace a name to continue." : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setError("");
    if (!name.trim()) {
      setError("Give your workspace a name to continue.");
      return;
    }
    workspaceTracker.creationStarted();
    createSiteMutation.mutate({ name: name.trim() });
  };

  const handleAbandonSignup = async () => {
    try {
      onboardingTracker.dropped({
        last_step: "workspace_details",
        last_route: "/onboarding/create-site",
      });
      await abandonSignupAsync();
      toast({ variant: "info", description: "Signup cancelled. You can start again anytime." });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Couldn't cancel signup. Try again.";
      toast({ variant: "error", description: message });
    }
  };

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title="Name your workspace"
        subtitle="You can fill in brand details later from the dashboard checklist."
      />
      <p className="mb-6 text-sm text-gray-500">Step 3 of 5</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Workspace name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="e.g. Acme Content"
            className="bg-gray-800 border-gray-700"
            autoFocus
          />
          {nameError && <p className="text-xs text-red-300">{nameError}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={createSiteMutation.isPending || !name.trim()}>
          {createSiteMutation.isPending ? "Creating…" : "Continue"}
        </Button>
      </form>

      <button
        type="button"
        onClick={handleAbandonSignup}
        disabled={isAbandoningSignup}
        className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-300"
      >
        {isAbandoningSignup ? "Leaving…" : "Exit signup"}
      </button>
    </AuthSplitLayout>
  );
}

export default function CreateSitePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <CreateSitePageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
