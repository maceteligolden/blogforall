"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { onboardingTracker } from "@/lib/analytics/flows/onboarding.tracker";

function VerifyEmailForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { setTokens, setUser, user } = useAuthStore();
  const { abandonSignupAsync, isAbandoningSignup } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const { data: wizardStatus } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!wizardStatus) return;
    if (wizardStatus.stage !== "email_verification") {
      router.replace(signupWizardPath(wizardStatus));
    }
  }, [wizardStatus, router]);

  const codeValid = useMemo(() => /^\d{6}$/.test(code.trim()), [code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!codeValid) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await AuthService.verifyEmail(code.trim());
      const data = res.data.data;
      setTokens(data.tokens.access_token, data.tokens.refresh_token);
      setUser(data.user);
      // Prevent company-role gate from bouncing on stale email_verification cache.
      queryClient.setQueryData(["onboarding", "signup-wizard"], { stage: "company_role" });
      toast({
        variant: "success",
        title: "Email verified",
        description: "Nice — tell us your role next.",
      });
      onboardingTracker.stepCompleted({ step: "email_verification" });
      router.push("/onboarding/company-role");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "That code doesn't look right. Try again or resend.";
      setError(message);
      toast({ variant: "error", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await AuthService.resendVerification();
      toast({
        variant: "info",
        description: "If your email still needs verifying, a new code is on the way.",
      });
    } catch {
      toast({
        variant: "error",
        description: "Couldn't resend the code. Wait a moment and try again.",
      });
    } finally {
      setResending(false);
    }
  };

  const handleAbandon = async () => {
    try {
      onboardingTracker.dropped({
        last_step: "email_verification",
        last_route: "/auth/verify-email",
      });
      await abandonSignupAsync();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Couldn't cancel signup.";
      toast({ variant: "error", description: message });
    }
  };

  return (
    <>
      <AuthPageHeader
        title="Check your inbox"
        subtitle={
          user?.email
            ? `We sent a 6-digit code to ${user.email}. Enter it below to continue.`
            : "Enter the 6-digit code we emailed you."
        }
      />
      <p className="mb-6 text-sm text-gray-500">Step 1 of 5</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className="bg-gray-800 border-gray-700 tracking-[0.3em] text-center text-lg"
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting || !codeValid}>
          {submitting ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="mt-4 w-full text-center text-sm text-primary hover:underline"
      >
        {resending ? "Sending…" : "Resend code"}
      </button>

      <button
        type="button"
        onClick={handleAbandon}
        disabled={isAbandoningSignup}
        className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-300"
      >
        {isAbandoningSignup ? "Leaving…" : "Exit signup"}
      </button>
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <ProtectedRoute>
      <VerifyEmailForm />
    </ProtectedRoute>
  );
}
