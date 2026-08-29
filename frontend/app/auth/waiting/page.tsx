"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AuthPageHeader } from "@/components/auth/auth-page-header";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/protected-route";
import { AuthService } from "@/lib/api/services/auth.service";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { needsBetaApproval, postOnboardingPath } from "@/lib/auth/beta-access";
import { signupWizardPath } from "@/lib/onboarding/signup-wizard";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth.store";

function WaitingContent() {
  const router = useRouter();
  const { logout, isLoading: isLoggingOut } = useAuth();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");

  const { data: wizardStatus, isFetched: wizardFetched } = useQuery({
    queryKey: ["onboarding", "signup-wizard"],
    queryFn: () => OnboardingService.getSignupWizardStatus(),
    retry: false,
  });

  const leaveIfReady = useCallback(() => {
    if (wizardStatus && wizardStatus.stage !== "complete") {
      router.replace(signupWizardPath(wizardStatus));
      return true;
    }
    if (wizardFetched && wizardStatus?.stage === "complete" && !needsBetaApproval(user)) {
      router.replace(postOnboardingPath(user));
      return true;
    }
    return false;
  }, [router, user, wizardStatus, wizardFetched]);

  useEffect(() => {
    leaveIfReady();
  }, [leaveIfReady]);

  const handleContinue = async () => {
    setChecking(true);
    setCheckError("");
    try {
      const response = await AuthService.getProfile();
      const profile = response.data.data;
      if (user) {
        setUser({
          ...user,
          account_type: profile.account_type,
          is_approved: profile.is_approved,
          first_name: profile.first_name ?? user.first_name,
          last_name: profile.last_name ?? user.last_name,
          email: profile.email ?? user.email,
        });
      }
      if (profile.account_type === "beta" && profile.is_approved === false) {
        setCheckError("Your account is still waiting for approval. We'll email you when you're in.");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setCheckError("Couldn't refresh your status. Try again in a moment.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <AuthPageHeader
        title="You're an early user"
        subtitle="Setup is done. We'll approve your account shortly so you can start using Bloggr."
      />
      <div className="space-y-6">
        <p className="text-sm text-gray-300 leading-relaxed">
          Thanks for joining the beta. We review every account before opening the dashboard. Watch your inbox — when
          you are approved, we will email you so you can start beta testing.
        </p>
        {checkError && (
          <div className="rounded-md bg-gray-800/80 border border-gray-700 p-3 text-sm text-gray-200">{checkError}</div>
        )}
        <Button type="button" className="w-full" onClick={handleContinue} disabled={checking}>
          {checking ? "Checking…" : "I've been approved — continue"}
        </Button>
        <button
          type="button"
          onClick={() => logout()}
          disabled={isLoggingOut}
          className="w-full text-sm text-gray-400 hover:text-white"
        >
          {isLoggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </>
  );
}

export default function WaitingPage() {
  return (
    <ProtectedRoute>
      <WaitingContent />
    </ProtectedRoute>
  );
}
