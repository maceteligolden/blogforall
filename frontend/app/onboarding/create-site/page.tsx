"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { OnboardingChatLayout } from "@/components/onboarding/onboarding-chat-layout";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { SiteService } from "@/lib/api/services/site.service";
import { OnboardingChat } from "@/components/orchestrator/onboarding-chat";
import { TokenExhaustionProvider } from "@/components/usage/token-exhaustion-provider";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useAuth } from "@/lib/hooks/use-auth";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";

type WizardStep = "details" | "chat";

function CreateSitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSiteId, user } = useAuthStore();
  const { updateSiteContext, abandonSignupAsync, isAbandoningSignup } = useAuth();

  const wantsChatStep = searchParams.get("step") === "chat";
  const siteIdParam = searchParams.get("siteId");
  const [step, setStep] = useState<WizardStep>(wantsChatStep ? "chat" : "details");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(siteIdParam);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [abandonError, setAbandonError] = useState("");

  useOnboardingDropoff(step === "chat" ? "orchestrator_chat" : "workspace_details");

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage === "plan_selection" || wizardStatus.stage === "invite") {
      router.replace(signupWizardPath(wizardStatus));
      return;
    }
    if (wizardStatus.stage === "complete") {
      router.replace("/dashboard");
    }
  }, [wizardStatus, router]);

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    retry: false,
  });

  useEffect(() => {
    if (siteIdParam && !activeSiteId) {
      setActiveSiteId(siteIdParam);
    }
  }, [siteIdParam, activeSiteId]);

  useEffect(() => {
    if (!sites || sitesLoading) return;

    const onboardingSite =
      sites.find((s) => s._id === siteIdParam && s.status === "onboarding") ||
      sites.find((s) => s._id === currentSiteId && s.status === "onboarding") ||
      sites.find((s) => s.status === "onboarding");

    if (onboardingSite) {
      updateSiteContext(onboardingSite._id);
      setActiveSiteId(onboardingSite._id);
      if (wantsChatStep || wizardStatus?.stage === "business_chat") {
        setStep("chat");
      }
    } else if (wantsChatStep && sites.length === 0) {
      setStep("details");
    }
  }, [sites, sitesLoading, currentSiteId, siteIdParam, wantsChatStep, updateSiteContext, wizardStatus?.stage]);

  const { createSiteMutation } = useCreateSiteMutations({
    onError: setError,
    onSiteReady: (site) => {
      setActiveSiteId(site._id);
      setStep("chat");
      router.replace(`/onboarding/create-site?step=chat&siteId=${encodeURIComponent(site._id)}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }
    workspaceTracker.creationStarted();
    createSiteMutation.mutate({ name: name.trim() });
  };

  const handleOnboardingCompleted = () => {
    router.push("/onboarding/plans");
  };

  const handleAbandonSignup = async () => {
    setAbandonError("");
    try {
      onboardingTracker.dropped({
        last_step: "orchestrator_chat",
        last_route: "/onboarding/create-site",
        onboarding_type: "workspace_setup",
      });
      await abandonSignupAsync();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not cancel signup. Please try again.";
      setAbandonError(message);
    }
  };

  if (step === "chat" && !activeSiteId && sitesLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-gray-400">Loading workspace setup...</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (step === "chat" && activeSiteId) {
    const firstName = user?.first_name ?? "";
    return (
      <ProtectedRoute>
        <OnboardingChatLayout firstName={firstName}>
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 px-4 pt-4 lg:px-8">
              <button
                type="button"
                onClick={handleAbandonSignup}
                disabled={isAbandoningSignup}
                className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>
              {abandonError && (
                <div className="mt-3 rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">
                  {abandonError}
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 lg:px-8 lg:pb-8">
              <TokenExhaustionProvider>
                <OnboardingChat
                  siteId={activeSiteId}
                  onCompleted={handleOnboardingCompleted}
                  hideHeader
                  firstName={firstName}
                />
              </TokenExhaustionProvider>
            </div>
          </div>
        </OnboardingChatLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AuthSplitLayout>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Name your workspace</h1>
          <p className="mt-2 text-sm text-gray-400">
            Step 1 of 4 — choose a name for your blog workspace. Next, we&apos;ll learn about your business.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
          )}

          <div>
            <Label htmlFor="site-name" className="text-gray-300">
              Workspace name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="site-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Blog"
              className="mt-1 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-400">You can rename this later from settings.</p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createSiteMutation.isPending || !name.trim()}
          >
            {createSiteMutation.isPending ? "Creating..." : "Continue"}
          </Button>
        </form>
      </AuthSplitLayout>
    </ProtectedRoute>
  );
}

export default function CreateSitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-gray-400">Loading...</p>
        </div>
      }
    >
      <CreateSitePageContent />
    </Suspense>
  );
}
