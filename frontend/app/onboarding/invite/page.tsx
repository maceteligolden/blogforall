"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";

/** Legacy onboarding invite route — redirects to dashboard. */
export default function OnboardingInvitePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </ProtectedRoute>
  );
}
