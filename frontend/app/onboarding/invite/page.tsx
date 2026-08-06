"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { SiteInvitationService } from "@/lib/api/services/site-invitation.service";
import { SiteService } from "@/lib/api/services/site.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { PendingInvitationsList } from "@/components/sites/pending-invitations-list";
import { useAuthStore } from "@/lib/store/auth.store";

const INVITE_PROMPT_SEEN_KEY = "blogforall_invite_prompt_seen";

function InviteOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const siteIdParam = searchParams.get("siteId") ?? undefined;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [error, setError] = useState("");
  const [sentCount, setSentCount] = useState(0);

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (wizardStatus && wizardStatus.stage !== "invite" && wizardStatus.stage !== "complete") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const { data: promptStatus, isLoading: promptLoading } = useQuery({
    queryKey: ["onboarding", "invite-prompt", siteIdParam],
    queryFn: () => OnboardingService.getInvitePromptStatus(siteIdParam),
  });

  const siteId = siteIdParam ?? promptStatus?.site_id ?? null;

  const { data: site } = useQuery({
    queryKey: siteId ? QUERY_KEYS.SITE(siteId) : ["site", "none"],
    queryFn: () => SiteService.getSiteById(siteId!),
    enabled: !!siteId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: siteId ? QUERY_KEYS.SITE_INVITATIONS(siteId) : [],
    queryFn: () => SiteInvitationService.getSiteInvitations(siteId!),
    enabled: !!siteId,
  });

  useEffect(() => {
    if (!promptLoading && promptStatus && !promptStatus.should_show && !siteIdParam) {
      router.replace("/dashboard");
    }
  }, [promptLoading, promptStatus, siteIdParam, router]);

  useEffect(() => {
    onboardingTracker.invitePromptViewed();
  }, []);

  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: "admin" | "editor" | "viewer" }) =>
      SiteInvitationService.createInvitation(siteId!, payload),
    onSuccess: () => {
      setSentCount((c) => c + 1);
      setEmail("");
      setError("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId!) });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to send invitation";
      setError(message);
    },
  });

  const finish = async (skipped: boolean) => {
    try {
      await OnboardingService.dismissInvitePrompt();
    } catch {
      // Continue to dashboard even if dismiss fails
    }
    // Optimistic cache so dashboard gate does not see stale requiresOnboarding / invite stage.
    queryClient.setQueryData(["onboarding", "signup-wizard"], {
      stage: "complete",
      site_id: siteId ?? undefined,
    });
    queryClient.setQueryData(["onboarding", "status"], {
      requiresOnboarding: false,
      hasCard: false,
      hasPlan: false,
    });
    if (siteId) {
      useAuthStore.getState().setCurrentSiteId(siteId);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["onboarding", "signup-wizard"] }),
      queryClient.invalidateQueries({ queryKey: ["onboarding", "status"] }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES }),
    ]);
    if (typeof window !== "undefined") {
      localStorage.setItem(INVITE_PROMPT_SEEN_KEY, "1");
    }
    if (skipped) {
      onboardingTracker.invitePromptSkipped();
    }
    router.push("/dashboard");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!siteId) {
      setError("No workspace selected for invitations");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    inviteMutation.mutate({ email: email.trim(), role });
  };

  if (promptLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <SignupWizardProgress stage="invite" />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Invite your team</h1>
          <p className="text-sm text-gray-400">
            {site?.name
              ? `Optional — add collaborators to ${site.name}, or skip and invite later`
              : "Optional — you can skip and invite later from settings"}
          </p>
        </div>
      </div>
      <p className="mb-6 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2 text-xs text-gray-400">
        Next: tell Bloggr about your business on the dashboard — about 2 minutes via the setup progress bar.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
        )}
        {sentCount > 0 && (
          <div className="rounded-md border border-green-800 bg-green-900/30 p-3 text-sm text-green-200">
            {sentCount} invitation{sentCount === 1 ? "" : "s"} sent.
          </div>
        )}

        <div>
          <Label htmlFor="invite-email" className="text-gray-300">
            Email address
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className="mt-1 border-gray-700 bg-gray-800 text-white"
          />
        </div>

        <div>
          <Label htmlFor="invite-role" className="text-gray-300">
            Role
          </Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="admin">Admin — manage members and content</option>
            <option value="editor">Editor — create and edit content</option>
            <option value="viewer">Viewer — read-only access</option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={inviteMutation.isPending || !siteId}
          className="w-full bg-primary text-white hover:bg-primary/90"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {inviteMutation.isPending ? "Sending..." : "Send invitation"}
        </Button>
      </form>

      {siteId && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Pending invitations</h3>
          <PendingInvitationsList siteId={siteId} invitations={invitations} compact />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="flex-1 whitespace-nowrap border-gray-700"
          onClick={() => finish(true)}
        >
          Skip for now
        </Button>
        <Button
          className="flex-1 whitespace-nowrap bg-gray-700 hover:bg-gray-600"
          onClick={() => finish(false)}
        >
          Continue
        </Button>
      </div>
    </AuthSplitLayout>
  );
}

export default function OnboardingInvitePage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <p className="text-gray-400">Loading...</p>
          </div>
        }
      >
        <InviteOnboardingContent />
      </Suspense>
    </ProtectedRoute>
  );
}
