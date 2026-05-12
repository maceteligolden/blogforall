"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/store/auth.store";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import type {
  ChatTurnResponse,
  OrchestratorApproval,
  OrchestratorMessage,
} from "@/lib/api/types/orchestrator.types";
import { ChatInput } from "./chat-input";
import { ChatMessage, ThinkingIndicator } from "./chat-message";
import { useAIPanel } from "./ai-panel-provider";

interface PendingTurn {
  userText: string;
}

interface OptimisticMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

function formatThreadTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString();
}

/**
 * Global full-screen orchestrator panel. Rendered once by the dashboard layout
 * and toggled via useAIPanel().open(). Designed to handle:
 *
 *  - listing the user's recent threads for the active workspace
 *  - loading a thread's full history on demand
 *  - sending messages with a "thinking" loader (no token streaming)
 *  - showing in-chat approval prompts and submitting yes / no decisions
 *  - starting a new thread without leaving the panel
 *
 * Onboarding-state workspaces have their own dedicated page and never reach
 * here, so we always run in "active" mode against the chat endpoint.
 */
export function AIPanel() {
  const { isOpen, close, threadId, setThreadId } = useAIPanel();
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<OrchestratorApproval | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const threadsQuery = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId) : ["orchestrator", "threads", "none"],
    queryFn: () => OrchestratorService.listThreads(currentSiteId as string, 30),
    enabled: isOpen && !!currentSiteId,
    refetchOnWindowFocus: false,
  });

  const threadQuery = useQuery({
    queryKey:
      currentSiteId && threadId
        ? QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, threadId)
        : ["orchestrator", "thread", "none"],
    queryFn: () => OrchestratorService.getThread(currentSiteId as string, threadId as string),
    enabled: isOpen && !!currentSiteId && !!threadId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setOptimisticMessages([]);
    setPending(null);
    setError(null);
    setPendingApproval(null);
  }, [isOpen, threadId]);

  useEffect(() => {
    const latest = threadQuery.data?.messages?.find(
      (m) => m.role === "assistant" && m.pending_approval_id
    );
    if (!latest) {
      setPendingApproval((prev) => (prev?.id ? null : prev));
      return;
    }
    // Don't synthesize an approval — the next chat turn will surface it
    // again if it's still open. We only clear stale local state here.
  }, [threadQuery.data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadQuery.data, optimisticMessages, pending]);

  const combinedMessages = useMemo<OptimisticMessage[]>(() => {
    const persisted: OptimisticMessage[] = (threadQuery.data?.messages ?? []).map(
      (m: OrchestratorMessage) => ({
        id: m._id,
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
        toolName: m.tool_name,
      })
    );
    return [...persisted, ...optimisticMessages];
  }, [threadQuery.data, optimisticMessages]);

  const handleSend = async (overrideText?: string) => {
    if (!currentSiteId) return;
    const text = (overrideText ?? input).trim();
    if (!text || pending) return;
    setError(null);
    if (!overrideText) setInput("");
    const userMsg: OptimisticMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };
    setOptimisticMessages((prev) => [...prev, userMsg]);
    setPending({ userText: text });
    try {
      const res: ChatTurnResponse = await OrchestratorService.chat(
        currentSiteId,
        text,
        threadId ?? undefined
      );
      const newOptimistic: OptimisticMessage[] = [];
      for (const call of res.tool_calls ?? []) {
        newOptimistic.push({
          id: `tool-${Date.now()}-${newOptimistic.length}`,
          role: "tool",
          content: call.summary,
          toolName: call.tool,
        });
      }
      newOptimistic.push({
        id: res.assistant_message.id,
        role: "assistant",
        content: res.assistant_message.content,
      });
      setOptimisticMessages((prev) => [...prev, ...newOptimistic]);
      setPendingApproval(res.pending_approval);
      if (threadId !== res.thread_id) {
        setThreadId(res.thread_id);
      }
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, res.thread_id),
      });
      if (res.pending_approval) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId),
        });
      }
    } catch (e: unknown) {
      const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setError(apiMessage ?? "Something went wrong. Please try again.");
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      if (!overrideText) setInput(text);
    } finally {
      setPending(null);
    }
  };

  const handleNewThread = () => {
    setThreadId(null);
    setOptimisticMessages([]);
    setPendingApproval(null);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace orchestrator chat"
      className="fixed inset-0 z-[10001] bg-black/95 backdrop-blur-sm flex"
    >
      <aside className="hidden md:flex md:w-72 lg:w-80 border-r border-gray-800 flex-col bg-black/70">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            <span className="font-semibold text-sm">Conversations</span>
          </div>
          <button
            onClick={handleNewThread}
            aria-label="Start new conversation"
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-gray-800 rounded-md px-2 py-1"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {threadsQuery.isLoading && (
            <p className="px-4 py-3 text-xs text-gray-500">Loading…</p>
          )}
          {threadsQuery.isError && (
            <p className="px-4 py-3 text-xs text-red-300">
              Couldn&apos;t load conversations.
            </p>
          )}
          {threadsQuery.data && threadsQuery.data.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-500">
              No conversations yet. Send your first message.
            </p>
          )}
          {threadsQuery.data?.map((t) => (
            <button
              key={t._id}
              onClick={() => setThreadId(t._id)}
              className={cn(
                "w-full text-left px-4 py-2.5 border-l-2 transition-colors",
                t._id === threadId
                  ? "border-primary bg-primary/10 text-white"
                  : "border-transparent text-gray-300 hover:bg-gray-900"
              )}
            >
              <p className="text-sm font-medium truncate">{t.title || "New conversation"}</p>
              <p className="text-xs text-gray-500">{formatThreadTimestamp(t.last_activity_at)}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {threadQuery.data?.thread?.title ?? "New conversation"}
              </p>
              <p className="text-xs text-gray-500">
                Workspace orchestrator — full-screen mode
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewThread}
              aria-label="Start new conversation"
              className="md:hidden flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-gray-800 rounded-md px-2 py-1"
            >
              <Plus className="w-3 h-3" aria-hidden="true" /> New
            </button>
            <button
              onClick={close}
              aria-label="Close orchestrator chat"
              className="text-gray-400 hover:text-white p-2 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4 max-w-4xl w-full mx-auto">
          {!threadId && combinedMessages.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30 mb-4">
                <Sparkles className="w-7 h-7 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold">How can I help today?</h2>
              <p className="text-sm text-gray-400 mt-2 max-w-lg mx-auto">
                Ask me to draft a blog post, list scheduled content, create a category,
                or look up performance for this workspace. I&apos;ll confirm any
                destructive actions before running them.
              </p>
            </div>
          )}
          {threadQuery.isLoading && threadId && (
            <p className="text-xs text-gray-500">Loading conversation…</p>
          )}
          {combinedMessages.map((m) => (
            <ChatMessage key={m.id} role={m.role} content={m.content} toolName={m.toolName} />
          ))}
          {pending && <ThinkingIndicator />}
          {error && (
            <div className="rounded-md bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {pendingApproval && (
            <div className="rounded-xl border border-yellow-700/60 bg-yellow-900/20 p-4">
              <p className="text-sm font-medium text-yellow-100">
                Confirmation needed: {pendingApproval.action}
              </p>
              <p className="text-xs text-yellow-200/80 mt-1">{pendingApproval.summary}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => handleSend("yes")}
                  disabled={!!pending}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSend("no")}
                  disabled={!!pending}
                  className="border-gray-700 text-gray-200 hover:bg-gray-800"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 md:px-6 py-3 border-t border-gray-800 max-w-4xl w-full mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={() => handleSend()}
            disabled={!!pending || !currentSiteId}
            autoFocus
            placeholder="Ask the orchestrator to act on this workspace..."
          />
          <p className="mt-2 text-xs text-gray-500">
            Destructive actions (delete, publish, unpublish) always ask for an in-chat
            confirmation before running.
          </p>
        </div>
      </main>
    </div>
  );
}
