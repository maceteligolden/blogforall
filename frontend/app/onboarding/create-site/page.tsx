"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
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
 *    flips the site to "active" we route on to the invite step.
 *
 * The page is also reachable mid-onboarding: if the user already has a
 * workspace that is still in the onboarding state (e.g. they refreshed during
 * chat), we skip step 1 and resume the chat directly.
 */
export default function CreateSitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentSiteId } = useAuthStore();
  const { updateSiteContext } = useAuth();

  const [step, setStep] = useState<WizardStep>("details");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");

  useOnboardingDropoff(step === "chat" ? "orchestrator_chat" : "workspace_details");

  // If we land here with an existing onboarding-state workspace, resume the chat.
  const { data: sites } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    retry: false,
  });

  useEffect(() => {
    const requestedStep = searchParams.get("step");
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
  }, [sites, currentSiteId, searchParams, updateSiteContext]);

  const { skipMutation, createSiteMutation } = useCreateSiteMutations({
    onError: setError,
    onSiteReady: (site) => {
      setActiveSiteId(site._id);
      setStep("chat");
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
    router.push("/onboarding/invite");
  };

  if (step === "chat" && activeSiteId) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-black text-white flex flex-col">
          <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col px-4 py-6">
            <div className="text-center mb-4">
              <h1 className="text-3xl font-bold">Finish workspace setup</h1>
              <p className="text-gray-400 text-sm mt-1">
                Chat with the orchestrator to capture your goals, audience, and voice.
              </p>
            </div>
            <div className="flex-1 rounded-2xl border border-gray-800 overflow-hidden">
              <TokenExhaustionProvider>
                <OnboardingChat
                  siteId={activeSiteId}
                  onCompleted={handleOnboardingCompleted}
                />
              </TokenExhaustionProvider>
            </div>
          </div>
        </div>
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
