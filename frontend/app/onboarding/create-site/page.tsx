"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/ui/modal";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthService } from "@/lib/api/services/auth.service";
import { SiteService } from "@/lib/api/services/site.service";
import { OnboardingChat } from "@/components/orchestrator/onboarding-chat";
import { TokenExhaustionProvider } from "@/components/usage/token-exhaustion-provider";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useAuth } from "@/lib/hooks/use-auth";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";

type WizardStep = "details" | "chat";

/**
 * Two-step site bootstrap.
 *
 *  - Step 1 ("details"): collect the workspace name + description and create
 *    the site. The backend marks the new site as status="onboarding".
 *  - Step 2 ("chat"): hand the user off to the orchestrator's onboarding chat
 *    to capture strategic / operational / voice context. When the orchestrator
 *    flips the site to "active" we route to the dashboard.
 *
 * The page is also reachable mid-onboarding: if the user already has a
 * workspace that is still in the onboarding state (e.g. they refreshed during
 * chat), we skip step 1 and resume the chat directly.
 */
function CreateSitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { currentSiteId, setCurrentSiteId, setTokens, refreshToken } = useAuthStore();
  const { updateSiteContext } = useAuth();

  const wantsChatStep = searchParams.get("step") === "chat";
  const [step, setStep] = useState<WizardStep>(wantsChatStep ? "chat" : "details");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelError, setCancelError] = useState<string>("");

  useOnboardingDropoff(step === "chat" ? "orchestrator_chat" : "workspace_details");

  // If we land here with an existing onboarding-state workspace, resume the chat.
  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    retry: false,
  });

  useEffect(() => {
    if (wantsChatStep && currentSiteId && !activeSiteId) {
      setActiveSiteId(currentSiteId);
    }
  }, [wantsChatStep, currentSiteId, activeSiteId]);

  useEffect(() => {
    const requestedStep = searchParams.get("step");
    if (!sitesLoading && sites && sites.length === 0 && step === "chat") {
      setStep("details");
      return;
    }
    if (!sites || sites.length === 0) return;
    const onboardingSite =
      sites.find((s) => s._id === currentSiteId && s.status === "onboarding") ||
      sites.find((s) => s.status === "onboarding");
    if (onboardingSite) {
      updateSiteContext(onboardingSite._id);
      setActiveSiteId(onboardingSite._id);
      setStep("chat");
      return;
    }
    if (requestedStep === "chat" && currentSiteId) {
      setActiveSiteId(currentSiteId);
      setStep("chat");
    }
  }, [sites, sitesLoading, currentSiteId, searchParams, step, updateSiteContext]);

  const { skipMutation, createSiteMutation } = useCreateSiteMutations({
    onError: setError,
    onSiteReady: (site) => {
      setActiveSiteId(site._id);
      setStep("chat");
    },
  });

  const activeSiteName =
    sites?.find((s) => s._id === activeSiteId)?.name ?? "this workspace";

  const cancelSetupMutation = useMutation({
    mutationFn: async (siteId: string) => {
      const siteName = sites?.find((s) => s._id === siteId)?.name;
      await SiteService.deleteSite(siteId);
      workspaceTracker.deleted({ workspace_name: siteName });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      const remaining = await SiteService.getSites();
      const nextSite =
        remaining.find((s) => s.status === "active") ?? remaining[0] ?? null;
      if (nextSite) {
        const response = await AuthService.updateSiteContext(nextSite._id);
        const accessToken = response.data?.data?.access_token;
        if (accessToken && refreshToken) {
          setTokens(accessToken, refreshToken);
        } else {
          setCurrentSiteId(nextSite._id);
        }
      } else {
        setCurrentSiteId(null);
      }
    },
    onSuccess: () => {
      setShowCancelConfirm(false);
      setCancelError("");
      router.push("/dashboard");
    },
    onError: (err: unknown) => {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      setCancelError(apiMessage ?? "Could not cancel setup. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Site name is required");
      return;
    }
    workspaceTracker.creationStarted();
    createSiteMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  const handleOnboardingCompleted = () => {
    router.push("/dashboard");
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
    return (
      <ProtectedRoute>
        <div className="h-dvh overflow-hidden bg-black text-white flex flex-col">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0 px-4 py-4 md:py-6">
            <button
              type="button"
              onClick={() => {
                setCancelError("");
                setShowCancelConfirm(true);
              }}
              disabled={cancelSetupMutation.isPending}
              className="shrink-0 inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-4 disabled:opacity-50 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              Back
            </button>
            <div className="shrink-0 text-center mb-4">
              <h1 className="text-3xl font-bold">Finish workspace setup</h1>
              <p className="text-gray-400 text-sm mt-1">
                Chat with the orchestrator to capture your goals, audience, and voice.
              </p>
            </div>
            {cancelError && !showCancelConfirm && (
              <div className="shrink-0 rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200 mb-4">
                {cancelError}
              </div>
            )}
            <div className="flex-1 min-h-0 rounded-2xl border border-gray-800 overflow-hidden">
              <TokenExhaustionProvider>
                <OnboardingChat
                  siteId={activeSiteId}
                  onCompleted={handleOnboardingCompleted}
                />
              </TokenExhaustionProvider>
            </div>
          </div>
        </div>

        <ConfirmModal
          isOpen={showCancelConfirm}
          onClose={() => {
            if (!cancelSetupMutation.isPending) {
              setShowCancelConfirm(false);
              setCancelError("");
            }
          }}
          onConfirm={() => {
            setCancelError("");
            cancelSetupMutation.mutate(activeSiteId);
          }}
          title="Cancel workspace setup?"
          message={`Going back will cancel workspace setup and permanently delete "${activeSiteName}". Any chat progress will be lost. You can create a new workspace later.`}
          confirmText="Yes, cancel setup"
          cancelText="Continue setup"
          variant="danger"
          closeOnConfirm={false}
          isConfirming={cancelSetupMutation.isPending}
        />
        {cancelError && showCancelConfirm && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10060] max-w-md w-full mx-4 rounded-md bg-red-900/90 border border-red-800 p-3 text-sm text-red-200 shadow-lg">
            {cancelError}
          </div>
        )}
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Create Your First Site
            </h1>
            <p className="text-xl text-gray-400">
              Step 1 of 2 — name your workspace. Next, the orchestrator will ask a few questions
              to tailor content to your business.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="site-name" className="text-gray-300">
                  Site Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="site-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Blog Site"
                  className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-400">
                  Choose a name for your site. You can change this later.
                </p>
              </div>

              <div>
                <Label htmlFor="site-description" className="text-gray-300">
                  Description (Optional)
                </Label>
                <textarea
                  id="site-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of your site"
                  rows={4}
                  className="mt-1 flex w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => skipMutation.mutate()}
                  disabled={skipMutation.isPending}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  {skipMutation.isPending ? "Skipping..." : "Use a default name"}
                </Button>
                <Button
                  type="submit"
                  disabled={createSiteMutation.isPending || !name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white px-8"
                >
                  {createSiteMutation.isPending ? "Creating..." : "Continue to setup chat"}
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              You can create additional workspaces later from the dashboard.
            </p>
          </div>
        </div>
      </div>
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
