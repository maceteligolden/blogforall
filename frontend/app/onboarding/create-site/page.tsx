"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { SiteService } from "@/lib/api/services/site.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import {
  canVisitStage,
  nextWizardPath,
  signupBootstrapRefreshKey,
  signupWizardPath,
} from "@/lib/onboarding/signup-wizard";
import { useWizardTransition } from "@/lib/onboarding/use-wizard-transition";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { WizardFormLoader } from "@/components/onboarding/wizard-form-loader";
import { useToast } from "@/components/ui/toast";

function CreateSitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { pending, begin, cancel, push } = useWizardTransition();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);
  const [prefilled, setPrefilled] = useState(false);

  useOnboardingDropoff("workspace_details");

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const siteId = searchParams.get("siteId") ?? wizardStatus?.site_id;
  const repairMode = Boolean(wizardStatus?.website_url_invalid && siteId);

  const { data: existingSite } = useQuery({
    queryKey: QUERY_KEYS.SITE(siteId ?? ""),
    queryFn: () => SiteService.getSiteById(siteId!),
    enabled: Boolean(siteId),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage !== "workspace_name" && !canVisitStage("workspace_name", wizardStatus.stage)) {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  useEffect(() => {
    if (!existingSite || prefilled) return;
    setName(existingSite.name);
    setWebsiteUrl(existingSite.website_url || wizardStatus?.website_url || "");
    setUrlTouched(true);
    setPrefilled(true);
  }, [existingSite, prefilled, wizardStatus?.website_url]);

  const { createSiteMutation, ensureDefaultMutation } = useCreateSiteMutations({
    onError: (msg) => {
      cancel();
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
      sessionStorage.setItem(signupBootstrapRefreshKey(site._id), "1");
      queryClient.setQueryData(["onboarding", "strategist-progress", site._id], {
        site_id: site._id,
        steps: [
          { id: "content_strategy", label: "Content strategy", status: "in_progress" },
          { id: "default_campaign", label: "Default campaign", status: "pending" },
          { id: "campaign_topics", label: "Campaign topics", status: "pending" },
        ],
        ready: false,
        failed: false,
      });
      queryClient.setQueryData(["onboarding", "signup-wizard"], {
        stage: "strategist_setup",
        site_id: site._id,
      });
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] });
      void queryClient.invalidateQueries({ queryKey: ["onboarding", "strategist-progress", site._id] });
      if (repairMode) {
        toast({
          variant: "success",
          title: "Website updated",
          description: "We'll generate your Content Strategy from the new URL.",
        });
        push(`/onboarding/setup?siteId=${encodeURIComponent(site._id)}`);
        return;
      }
      onboardingTracker.stepCompleted({ step: "workspace_name" });
      toast({
        variant: "success",
        title: existingSite ? "Workspace saved" : "Workspace created",
        description: `"${site.name}" is set up. Next we'll generate your Content Strategy.`,
      });
      push(nextWizardPath("workspace_name", site._id));
    },
  });

  const nameError = nameTouched && !name.trim() ? "Give your workspace a name to continue." : "";
  const urlUnchanged = Boolean(
    existingSite?.website_url && websiteUrl.trim() && websiteUrl.trim() === existingSite.website_url
  );
  const urlError = repairMode
    ? urlUnchanged
      ? "Could not read that website. Check the URL and try again."
      : !websiteUrl.trim()
        ? "Add your website URL so we can generate Content Strategy."
        : ""
    : urlTouched && !websiteUrl.trim()
      ? "Add your website URL so we can generate Content Strategy."
      : "";
  const submitting = pending || createSiteMutation.isPending || ensureDefaultMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    setUrlTouched(true);
    setError("");
    if (!name.trim()) {
      setError("Give your workspace a name to continue.");
      return;
    }
    if (!websiteUrl.trim()) {
      setError("Add your website URL so we can generate Content Strategy.");
      return;
    }
    begin();
    if (repairMode || siteId) {
      ensureDefaultMutation.mutate({ name: name.trim(), website_url: websiteUrl.trim() });
      return;
    }
    workspaceTracker.creationStarted();
    createSiteMutation.mutate({ name: name.trim(), website_url: websiteUrl.trim() });
  };

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title={repairMode ? "Update your website URL" : "Create your workspace"}
        subtitle={
          repairMode
            ? "We couldn't read that website. Update the URL so we can generate your Content Strategy."
            : "We'll generate your Content Strategy from your website in the background."
        }
        clearSignupAttempt
      />
      <SignupWizardProgress stage="workspace_name" siteId={siteId ?? undefined} />

      {error && !pending && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {pending ? (
        <WizardFormLoader label={repairMode ? "Saving website…" : "Creating workspace…"} />
      ) : (
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
              autoFocus={!repairMode}
            />
            {nameError && <p className="text-xs text-red-300">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website URL</Label>
            <Input
              id="website"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onBlur={() => setUrlTouched(true)}
              placeholder="https://example.com"
              className={
                repairMode ? "bg-gray-800 border-red-500 focus-visible:ring-red-500" : "bg-gray-800 border-gray-700"
              }
              autoFocus={repairMode}
            />
            {urlError && <p className="text-xs text-red-300">{urlError}</p>}
          </div>

          <p className="text-xs text-gray-500">
            {repairMode
              ? "After you save a readable URL, we'll generate your Content Strategy, default campaign, and topics."
              : "Next we'll generate your Content Strategy, default campaign, and topics from your website. You can invite teammates after that."}
          </p>

          <Button type="submit" className="w-full" disabled={submitting || !name.trim() || !websiteUrl.trim()}>
            {submitting ? (repairMode ? "Saving…" : "Creating…") : repairMode ? "Save and continue" : "Continue"}
          </Button>
        </form>
      )}
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
