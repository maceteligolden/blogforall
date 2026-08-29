"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BetaAccessClient,
  type BetaAccessContext,
  type BetaAccessDecision,
} from "@/lib/api/services/beta-access.service";

type Mode = "approve" | "reject";

export function BetaDecisionPage({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  const [context, setContext] = useState<BetaAccessContext | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [decision, setDecision] = useState<BetaAccessDecision | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoadError("This approval link is missing a token.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const ctx = await BetaAccessClient.getContext(token);
        if (!cancelled) setContext(ctx);
      } catch (e: unknown) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    if (submitting) return;
    setActionError("");
    setSubmitting(true);
    try {
      const result = mode === "approve" ? await BetaAccessClient.approve(token) : await BetaAccessClient.reject(token);
      setDecision(result);
    } catch (e: unknown) {
      setActionError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span>Loading applicant…</span>
        </div>
      </div>
    );
  }

  if (loadError || !context) {
    return (
      <Centered>
        <h1 className="text-2xl font-bold mb-2">Link unavailable</h1>
        <p className="text-gray-400 text-sm">{loadError || "Please request a fresh approval email."}</p>
      </Centered>
    );
  }

  if (decision || (mode === "approve" && context.is_approved) || (mode === "reject" && context.rejected)) {
    const approved = decision?.is_approved ?? context.is_approved;
    const already = decision?.already_decided ?? true;
    return (
      <Centered>
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 border border-primary/40 mb-5">
          {approved ? (
            <CheckCircle2 className="w-7 h-7 text-primary" aria-hidden="true" />
          ) : (
            <XCircle className="w-7 h-7 text-primary" aria-hidden="true" />
          )}
        </div>
        <h1 className="text-2xl font-bold mb-2">{approved ? "Approved" : "Rejection recorded"}</h1>
        <p className="text-gray-300 text-sm">
          {context.first_name} {context.last_name} ({context.email})
          {already
            ? " — this decision was already saved."
            : approved
              ? " can now start beta testing."
              : " stays on the wait screen."}
        </p>
        <p className="text-xs text-gray-500 mt-4">You can close this page.</p>
      </Centered>
    );
  }

  const isApprove = mode === "approve";
  return (
    <Centered>
      <h1 className="text-2xl font-bold mb-2">{isApprove ? "Approve this account?" : "Reject this account?"}</h1>
      <p className="text-gray-300 text-sm mb-6">
        {context.first_name} {context.last_name}
        <br />
        <span className="text-gray-400">{context.email}</span>
      </p>
      {actionError && <p className="text-sm text-red-300 mb-4">{actionError}</p>}
      <Button type="button" className="w-full" onClick={handleConfirm} disabled={submitting}>
        {submitting ? "Saving…" : isApprove ? "Approve account" : "Record rejection"}
      </Button>
      <p className="text-xs text-gray-500 mt-4">
        {isApprove
          ? "They'll get an email that they can start beta testing."
          : "They stay on the wait screen. You can still approve them later."}
      </p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">{children}</div>
    </div>
  );
}
