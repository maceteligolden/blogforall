"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { useInvitationResponseMutations } from "@/lib/hooks/use-invitation-response-mutations";
import { SiteInvitationService } from "@/lib/api/services/site-invitation.service";
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

  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
  } = useQuery({
    queryKey: ["invitation-preview", token],
    queryFn: () => SiteInvitationService.getInvitationPreview(token!),
    enabled: !!token,
    retry: false,
  });

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
    if (!token || previewLoading || !preview) return;
    if (!isAuthenticated) {
      if (preview.requires_signup) {
        const params = new URLSearchParams({
          invite: token,
          email: preview.email,
        });
        router.replace(`/auth/signup?${params.toString()}`);
        return;
      }
      const returnUrl = `/invitations/accept?token=${encodeURIComponent(token)}`;
      router.replace(`/auth/login?redirect=${encodeURIComponent(returnUrl)}`);
    }
  }, [isAuthenticated, preview, previewLoading, router, token]);

  useEffect(() => {
    if (status === "accepted") {
      const t = setTimeout(() => router.push("/dashboard"), 2000);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  if (!token) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-gray-400 mb-4">
            Missing invitation token. Please use the link from your invitation email.
          </p>
          <Link href="/dashboard" className="text-primary hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (previewLoading || (!isAuthenticated && preview && !preview.requires_signup)) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading invitation...</div>
      </div>
    );
  }

  if (previewError) {
    const message =
      (previewError as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      "This invitation is no longer valid.";
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-4">{message}</p>
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Redirecting...</div>
      </div>
    );
  }

  const roleLabel = preview?.role ? preview.role.charAt(0).toUpperCase() + preview.role.slice(1) : "Member";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-800 p-8 text-center">
        {status === "idle" && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Workspace invitation</h1>
            <p className="text-gray-400 mb-2">
              <strong className="text-white">{preview?.inviter_name}</strong> invited you to join{" "}
              <strong className="text-white">{preview?.site_name}</strong> as {roleLabel}.
            </p>
            <p className="text-xs text-gray-500 mb-6">Invitation for {preview?.email}</p>
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
            <Link href="/dashboard" className="text-primary hover:underline">
              Go to dashboard
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-4">{errorMessage}</p>
            <Link href="/dashboard" className="text-primary hover:underline">
              Go to dashboard
            </Link>
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
