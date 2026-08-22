"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useToast } from "@/components/ui/toast";
import type { OrchestratorMessage, ThreadFocus, ThreadWithMessages } from "@/lib/api/types/orchestrator.types";
import { compactThreadFocus } from "@/lib/writing/compact-thread-focus";

export const WRITING_THREAD_PENDING_KEY = "bloggr_writing_thread_pending";
export const FIRST_POST_THREAD_LOCK_PREFIX = "bloggr_first_post_thread:";

export type WritingThreadRequest = ThreadFocus & {
  campaign_name?: string;
  stayOnPage?: boolean;
  first_post?: boolean;
};

const OPERATOR_KICKOFF_MARKERS = [
  "load the writing skill",
  "writing_request_research (hitl)",
  "do not call research_run",
  "don't start a new draft unless i ask",
  "don't start a draft until i pick a topic",
  "help me improve this draft with natural-language edits",
];

function firstPostLockKey(siteId: string): string {
  return `${FIRST_POST_THREAD_LOCK_PREFIX}${siteId}`;
}

/** User-facing first message. Operator rules live in the writing-mode system prompt + focus. */
export function kickoffMessage(req: WritingThreadRequest): string {
  if (req.blog_id) {
    return `Help me improve "${req.topic || "this draft"}".`;
  }
  if (req.topic) {
    return `Let's write "${req.topic}".`;
  }
  return `Let's write the next undrafted post.`;
}

export function campaignKickoffMessage(campaignName: string, topicTitle?: string): string {
  if (topicTitle) {
    return `Let's talk about "${topicTitle}" for ${campaignName}.`;
  }
  return `Let's work on "${campaignName}".`;
}

/**
 * Map a persisted user row to what the chat should show.
 * Returns null when the row is operator-only kickoff text and should be hidden.
 */
export function toDisplayUserContent(content: string): string | null {
  const theySaid = content.match(/\n\nThey said:\s*([\s\S]+)$/);
  if (theySaid) {
    const note = theySaid[1].trim();
    return note || null;
  }
  const lower = content.toLowerCase();
  if (OPERATOR_KICKOFF_MARKERS.some((marker) => lower.includes(marker))) {
    return null;
  }
  return content;
}

export function threadHasConversation(messages: OrchestratorMessage[] | undefined): boolean {
  return (messages ?? []).some((m) => m.role === "user" || m.role === "assistant");
}

export function persistWritingThreadRequest(req: WritingThreadRequest): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(WRITING_THREAD_PENDING_KEY, JSON.stringify(req));
}

export function persistFirstPostWritingRequest(): void {
  persistWritingThreadRequest({ first_post: true });
}

export function claimWritingThreadRequest(siteId?: string): WritingThreadRequest | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(WRITING_THREAD_PENDING_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(WRITING_THREAD_PENDING_KEY);
  let req: WritingThreadRequest;
  try {
    req = JSON.parse(raw) as WritingThreadRequest;
  } catch {
    return null;
  }
  if (req.first_post && siteId) {
    const lockKey = firstPostLockKey(siteId);
    if (localStorage.getItem(lockKey)) return null;
    localStorage.setItem(lockKey, "1");
  }
  return req;
}

export function releaseFirstPostLock(siteId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(firstPostLockKey(siteId));
}

export function useStartWritingThread() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { setThreadId, focusComposer, beginWritingKickoff, endWritingKickoff } = useOrchestrator();
  const inFlight = useRef(false);

  const startWritingThread = useCallback(
    async (req: WritingThreadRequest, siteIdOverride?: string) => {
      const siteId = siteIdOverride ?? currentSiteId;
      if (!siteId || inFlight.current) return;
      const label = kickoffMessage(req);
      beginWritingKickoff(label);
      const onDashboard = pathname === "/dashboard";
      const onEditor = Boolean(req.blog_id && pathname.startsWith(`/dashboard/posts/${req.blog_id}`));
      if (!req.stayOnPage && !onDashboard && !onEditor) {
        persistWritingThreadRequest({ ...req, stayOnPage: false });
        router.push("/dashboard");
        return;
      }

      inFlight.current = true;
      try {
        const focus: ThreadFocus | undefined = compactThreadFocus({
          campaign_id: req.campaign_id,
          roadmap_sequence_index: req.roadmap_sequence_index,
          blog_id: req.blog_id,
          topic: req.topic,
          intent: req.intent,
        });
        const thread = await OrchestratorService.createThread(siteId, { focus });
        const resolvedId = thread._id;
        if (!resolvedId) {
          throw new Error("Couldn't start the writing conversation.");
        }
        setThreadId(resolvedId);

        const withMessages: ThreadWithMessages = await OrchestratorService.getThread(siteId, resolvedId);
        queryClient.setQueryData(QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, resolvedId), withMessages);

        if (!threadHasConversation(withMessages.messages)) {
          const res = await OrchestratorService.chat(siteId, label, resolvedId, {
            sessionMode: "writing",
            focus,
          });
          await queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, res.thread_id || resolvedId),
          });
        }

        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId) });
        focusComposer();
      } catch (err: unknown) {
        if (req.first_post && siteId) releaseFirstPostLock(siteId);
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Couldn't start the writing conversation. Try again.";
        toast({ variant: "error", description: message });
      } finally {
        inFlight.current = false;
        endWritingKickoff();
      }
    },
    [
      currentSiteId,
      pathname,
      router,
      queryClient,
      toast,
      setThreadId,
      focusComposer,
      beginWritingKickoff,
      endWritingKickoff,
    ]
  );

  return { startWritingThread };
}
