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
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";
import { useOnboardingDropoff } from "@/lib/analytics/hooks/use-onboarding-dropoff";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { useToast } from "@/components/ui/toast";

function CreateSitePageContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [urlTouched, setUrlTouched] = useState(false);

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
        stage: "invite",
        site_id: site._id,
      });
      onboardingTracker.stepCompleted({ step: "workspace_name" });
      toast({
        variant: "success",
        title: "Workspace created",
        description: `"${site.name}" is set up. Next you can invite teammates.`,
      });
      router.push(`/onboarding/invite?siteId=${encodeURIComponent(site._id)}`);
    },
  });

  const nameError = nameTouched && !name.trim() ? "Give your workspace a name to continue." : "";
  const urlError = urlTouched && !websiteUrl.trim() ? "Add your website URL so we can generate Content Strategy." : "";

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
    workspaceTracker.creationStarted();
    createSiteMutation.mutate({ name: name.trim(), website_url: websiteUrl.trim() });
  };

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title="Create your workspace"
        subtitle="We'll generate your Content Strategy from your website in the background."
      />
      <SignupWizardProgress stage="workspace_name" />

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

        <div className="space-y-2">
          <Label htmlFor="website">Website URL</Label>
          <Input
            id="website"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            onBlur={() => setUrlTouched(true)}
            placeholder="https://example.com"
            className="bg-gray-800 border-gray-700"
          />
          {urlError && <p className="text-xs text-red-300">{urlError}</p>}
        </div>

        <p className="text-xs text-gray-500">
          Next you can invite teammates, then we&apos;ll generate your Content Strategy, default campaign, and topics
          from your website.
        </p>

        <Button
          type="submit"
          className="w-full"
          disabled={createSiteMutation.isPending || !name.trim() || !websiteUrl.trim()}
        >
          {createSiteMutation.isPending ? "Creating…" : "Continue"}
        </Button>
      </form>
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
