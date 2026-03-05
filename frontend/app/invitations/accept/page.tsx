"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { useInvitationResponseMutations } from "@/lib/hooks/use-invitation-response-mutations";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

type InvitationStatus = "idle" | "loading" | "accepted" | "rejected" | "error";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<InvitationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const { acceptMutation, rejectMutation } = useInvitationResponseMutations({
    token,
    onAcceptSuccess: () => setStatus("accepted"),
    onRejectSuccess: () => setStatus("rejected"),
    onAcceptError: (msg) => {
      setStatus("error");
      setErrorMessage(msg);
    },
    onRejectError: () => setStatus("error"),
  });

  useEffect(() => {
    if (!isAuthenticated && typeof window !== "undefined" && token) {
      const returnUrl = `/invitations/accept?token=${encodeURIComponent(token)}`;
      router.push(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [isAuthenticated, router, token]);

  useEffect(() => {
    if (status === "accepted") {
      const t = setTimeout(() => router.push("/dashboard"), 2000);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Redirecting to sign in...</div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-gray-400 mb-4">Missing invitation token. Please use the link from your invitation email.</p>
          <Link href="/dashboard" className="text-primary hover:underline">Go to dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-800 p-8 text-center">
        {status === "idle" && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Workspace invitation</h1>
            <p className="text-gray-400 mb-6">You have been invited to join a workspace. Accept to get access.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Decline
              </Button>
              <Button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />
                    Accepting...
                  </>
                ) : (
                  "Accept"
                )}
              </Button>
            </div>
          </>
        )}
        {status === "accepted" && (
          <>
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">You joined the workspace</h2>
            <p className="text-gray-400 mb-4">Redirecting you to the dashboard...</p>
          </>
        )}
        {status === "rejected" && (
          <>
            <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Invitation declined</h2>
            <Link href="/dashboard" className="text-primary hover:underline">Go to dashboard</Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">{errorMessage}</p>
            <Link href="/dashboard" className="text-primary hover:underline">Go to dashboard</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
