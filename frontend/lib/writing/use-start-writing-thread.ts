"use client";

import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useToast } from "@/components/ui/toast";
import type { ThreadFocus } from "@/lib/api/types/orchestrator.types";

export const WRITING_THREAD_PENDING_KEY = "bloggr_writing_thread_pending";

export type WritingThreadRequest = ThreadFocus & {
  campaign_name?: string;
  stayOnPage?: boolean;
};

export function kickoffMessage(req: WritingThreadRequest): string {
  if (req.blog_id) {
    return `Help me improve this draft with natural-language edits. The post is already in the editor. Load the writing skill and use writing_revise_draft for changes I ask for.`;
  }
  if (req.topic) {
    const campaign = req.campaign_name ? ` for ${req.campaign_name}` : "";
    return `Let's write the blog post "${req.topic}"${campaign}. Keep this roadmap topic unless a new angle still serves the campaign goal and Content Strategy. Talk through the angle like a colleague — one question at a time. Don't start research until I agree. Load the writing skill. Use writing_request_research (HITL) to start research — do not call research_run. We only write blog posts.`;
  }
  return `Let's write the next undrafted blog post. Load the writing skill, call writing_next_due, bind the top topic, then discuss the angle before any research. Use writing_request_research (HITL) — do not call research_run. We only write blog posts.`;
}

export function writingLoopUserMessage(req: WritingThreadRequest, userNote?: string): string {
  const base = kickoffMessage(req);
  const note = userNote?.trim();
  if (!note) return base;
  const alreadyKickoff =
    note.toLowerCase().includes("load the writing skill") ||
    (req.topic ? note.toLowerCase().includes(`let's write "${req.topic.toLowerCase()}"`) : false);
  if (alreadyKickoff) return note;
  return `${base}\n\nThey said: ${note}`;
}

export function persistWritingThreadRequest(req: WritingThreadRequest): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(WRITING_THREAD_PENDING_KEY, JSON.stringify(req));
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
      const label = req.blog_id
        ? `Help me improve "${req.topic || "this draft"}".`
        : req.topic
          ? `Let's write "${req.topic}".`
          : "Let's write the next undrafted post.";
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
        const focus: ThreadFocus = {
          campaign_id: req.campaign_id,
          roadmap_sequence_index: req.roadmap_sequence_index,
          blog_id: req.blog_id,
          topic: req.topic,
          intent: req.intent,
        };
        const res = await OrchestratorService.chat(siteId, kickoffMessage(req), undefined, {
          sessionMode: "auto",
          focus,
        });
        if (res.thread_id) {
          setThreadId(res.thread_id);
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId) });
          void queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, res.thread_id),
          });
        }
        focusComposer();
      } catch (err: unknown) {
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
