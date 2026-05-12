"use client";

import { use, useEffect, useState } from "react";
import { CheckCircle2, Edit3, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScheduledPostReviewClient } from "@/lib/api/services/scheduled-post-review.service";
import type {
  ReviewContext,
  ReviewDecisionResult,
} from "@/lib/api/types/scheduled-post-review.types";

/**
 * Public scheduled-post review page reached from the orchestrator's weekly
 * digest email. The single-use token in the URL authenticates the request;
 * the page is intentionally JWT-less so the reviewer can act from any
 * inbox, on any device.
 */
export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [context, setContext] = useState<ReviewContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkComments, setReworkComments] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "rework" | null>(null);
  const [decision, setDecision] = useState<ReviewDecisionResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ctx = await ScheduledPostReviewClient.getContext(token);
        if (!cancelled) setContext(ctx);
      } catch (e: unknown) {
        if (!cancelled) setLoadError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleApprove = async () => {
    if (submitting) return;
    setActionError(null);
    setSubmitting("approve");
    try {
      const result = await ScheduledPostReviewClient.approve(token);
      setDecision(result);
    } catch (e: unknown) {
      setActionError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  const handleRework = async () => {
    if (submitting) return;
    const trimmed = reworkComments.trim();
    if (!trimmed) {
      setActionError("Please describe what to change.");
      return;
    }
    setActionError(null);
    setSubmitting("rework");
    try {
      const result = await ScheduledPostReviewClient.rework(token, trimmed);
      setDecision(result);
    } catch (e: unknown) {
      setActionError((e as Error).message);
    } finally {
      setSubmitting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span>Loading review…</span>
        </div>
      </div>
    );
  }

  if (loadError || !context) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Review link unavailable</h1>
          <p className="text-gray-400 text-sm">{loadError ?? "Please request a fresh link."}</p>
        </div>
      </div>
    );
  }

  if (decision) {
    const isApproval = decision.status === "approved";
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 border border-primary/40 mb-5">
            {isApproval ? (
              <CheckCircle2 className="w-7 h-7 text-primary" aria-hidden="true" />
            ) : (
              <Edit3 className="w-7 h-7 text-primary" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {isApproval ? "Approved" : "Rework requested"}
          </h1>
          <p className="text-gray-300 text-sm">{decision.message}</p>
          <p className="text-xs text-gray-500 mt-4">You can safely close this page.</p>
        </div>
      </div>
    );
  }

  const { scheduled_post, blog } = context;
  const expiresAt = new Date(context.token.expires_at);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-primary text-xs uppercase tracking-wider mb-2">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>Scheduled post review</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">{scheduled_post.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>Scheduled for {new Date(scheduled_post.scheduled_at).toLocaleString()}</span>
            <span>·</span>
            <span>Round {scheduled_post.rework_round + 1}</span>
            <span>·</span>
            <span>Link expires {expiresAt.toLocaleDateString()}</span>
          </div>
          {scheduled_post.rework_comments && scheduled_post.rework_round > 0 && (
            <div className="mt-4 rounded-md border border-gray-800 bg-gray-900/60 px-3 py-2 text-xs text-gray-300">
              <p className="font-semibold text-gray-200">Previous rework notes</p>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                {scheduled_post.rework_comments}
              </p>
            </div>
          )}
        </header>

        <article className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 md:p-8">
          {blog ? (
            <>
              {blog.excerpt && (
                <p className="text-gray-300 text-base italic mb-6">{blog.excerpt}</p>
              )}
              <div
                className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-200 prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              The draft for this scheduled post is not yet available. Please request a fresh link.
            </p>
          )}
        </article>

        {actionError && (
          <div className="mt-4 rounded-md bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-200">
            {actionError}
          </div>
        )}

        {!reworkOpen ? (
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setActionError(null);
                setReworkOpen(true);
              }}
              disabled={!!submitting || !blog}
              className="border-gray-700 text-gray-200 hover:bg-gray-800"
            >
              <Edit3 className="w-4 h-4 mr-2" aria-hidden="true" /> Request rework
            </Button>
            <Button
              onClick={handleApprove}
              disabled={!!submitting || !blog}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {submitting === "approve" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Approving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" aria-hidden="true" /> Approve & schedule
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
            <p className="text-sm font-semibold mb-2">Describe what to change</p>
            <p className="text-xs text-gray-400 mb-3">
              The orchestrator will rewrite the draft using your feedback and email you a new
              review link.
            </p>
            <textarea
              value={reworkComments}
              onChange={(e) => setReworkComments(e.target.value)}
              rows={6}
              maxLength={4000}
              autoFocus
              placeholder="e.g. Shorten the intro, add a section on pricing, and tighten the conclusion."
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <div className="mt-3 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setReworkOpen(false);
                  setReworkComments("");
                  setActionError(null);
                }}
                disabled={!!submitting}
                className="border-gray-700 text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRework}
                disabled={!!submitting || reworkComments.trim().length === 0}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {submitting === "rework" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Sending…
                  </>
                ) : (
                  "Send rework request"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
