"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";
import { useToast } from "@/components/ui/toast";
import { AuthService } from "@/lib/api/services/auth.service";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth.store";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { SignupWizardProgress } from "@/components/onboarding/signup-wizard-progress";
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";

const ROLES = [
  { id: "founder", label: "Founder / CEO", hint: "You own the vision and content strategy." },
  { id: "marketer", label: "Marketer", hint: "Growth, SEO, and campaigns." },
  { id: "content", label: "Content creator", hint: "Writing and publishing day-to-day." },
  { id: "engineer", label: "Engineer / product", hint: "Technical storytelling and docs." },
  { id: "agency", label: "Agency", hint: "You manage blogs for clients." },
  { id: "other", label: "Other", hint: "Tell us in a few words." },
] as const;

function CompanyRoleContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setTokens, setUser } = useAuthStore();
  const { abandonSignupAsync, isAbandoningSignup } = useAuth();
  const [role, setRole] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage !== "company_role") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!role) {
      setError("Pick the role that fits you best.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await AuthService.setCompanyRole({
        company_role: role,
        company_role_detail: role === "other" ? detail.trim() || undefined : undefined,
      });
      const data = res.data.data;
      setTokens(data.tokens.access_token, data.tokens.refresh_token);
      setUser(data.user);
      queryClient.setQueryData(["onboarding", "signup-wizard"], { stage: "workspace_name" });
      onboardingTracker.stepCompleted({ step: "company_role" });
      toast({
        variant: "success",
        description: "Got it — we'll tailor advice to how you work.",
      });
      router.push("/onboarding/create-site");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Couldn't save your role. Try again.";
      setError(message);
      toast({ variant: "error", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <AuthPageHeader
        title="What's your role?"
        subtitle="We'll use this so the AI talks about your business in a way that fits how you work."
      />
      <SignupWizardProgress stage="company_role" />

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRole(r.id)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                role === r.id
                  ? "border-primary bg-primary/15 text-white"
                  : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-600"
              }`}
            >
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-gray-500">{r.hint}</div>
            </button>
          ))}
        </div>

        {role === "other" && (
          <div className="space-y-2">
            <Label htmlFor="detail">Tell us a bit more</Label>
            <Input
              id="detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. Freelance SEO consultant"
              className="bg-gray-800 border-gray-700"
            />
          </div>
        )}

        <Button type="submit" className="w-full" disabled={submitting || !role}>
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </form>

      <button
        type="button"
        onClick={async () => {
          try {
            onboardingTracker.dropped({
              last_step: "company_role",
              last_route: "/onboarding/company-role",
            });
            await abandonSignupAsync();
          } catch {
            toast({ variant: "error", description: "Couldn't cancel signup." });
          }
        }}
        disabled={isAbandoningSignup}
        className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-300"
      >
        {isAbandoningSignup ? "Leaving…" : "Exit signup"}
      </button>
    </AuthSplitLayout>
  );
}

export default function CompanyRolePage() {
  return (
    <ProtectedRoute>
      <CompanyRoleContent />
    </ProtectedRoute>
  );
}
