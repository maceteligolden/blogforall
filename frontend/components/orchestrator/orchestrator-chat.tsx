"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, PanelRight, Pencil, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/store/auth.store";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import type {
  ChatTurnResponse,
  OrchestratorApproval,
  OrchestratorMessage,
  V05MoatSnapshot,
} from "@/lib/api/types/orchestrator.types";
import { ChatComposer } from "./chat-composer";
import { ChatMessage, ThinkingIndicator } from "./chat-message";
import { FullConversationView, type ConversationStatus } from "./full-conversation-view";
import { KnowledgeBaseModal } from "./knowledge-base-modal";
import { useOrchestrator } from "./orchestrator-provider";
import { useTokenUsage, useInvalidateTokenUsage } from "@/lib/hooks/use-token-usage";
import { useTokenExhaustion } from "@/components/usage/token-exhaustion-provider";
import { orchestratorTracker } from "@/lib/analytics/flows/orchestrator.tracker";
import {
  findArtifactIdForAssistantMessage,
  findArtifactIdForToolMessage,
  extractBlogIdFromArtifactData,
  DRAFT_ARTIFACT_TOOLS,
  VIEWABLE_ARTIFACT_TOOLS,
  patchBlogCacheFromToolOutput,
  type OrchestratorArtifact,
} from "@/lib/utils/orchestrator-artifacts";
import { extractMoatSnapshot } from "@/lib/utils/moat-snapshot";
import { parseExplicitSessionModeSwitch, isWritingEffectiveMode } from "@/lib/utils/session-mode-parser";
import { useOrchestratorArtifacts } from "@/lib/hooks/use-orchestrator-artifacts";
import { useSpeechSynthesis } from "@/lib/hooks/use-speech-synthesis";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";

interface PendingTurn {
  userText: string;
}

interface OptimisticMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  artifactId?: string;
  moat?: V05MoatSnapshot | null;
}

interface OrchestratorChatProps {
  className?: string;
  mobileArtifactsOpen?: boolean;
  onShowMobileArtifacts?: () => void;
  onToggleMobileArtifacts?: () => void;
}

/**
 * Embedded orchestrator chat for the dashboard workspace.
 */
export function OrchestratorChat({
  className,
  mobileArtifactsOpen,
  onShowMobileArtifacts,
  onToggleMobileArtifacts,
}: OrchestratorChatProps) {
  const {
    threadId,
    setThreadId,
    mergeLiveArtifacts,
    clearLiveArtifacts,
    sessionMode,
    setSessionMode,
    setEffectiveSessionMode,
    effectiveSessionMode,
    isWritingPinned,
    setDraftGenerating,
    setActiveDraftBlogId,
    activeDraftBlogId,
    selectionContext,
    pendingAttachments,
    clearPendingAttachments,
    voiceMode,
    openResultsPanel,
    conversationMode,
    exitConversationMode,
    livePhase,
    clearLivePhase,
    setupInterviewActive,
    setSetupInterviewActive,
  } = useOrchestrator();
  const { artifacts, hasArtifacts, showResultsPanel } = useOrchestratorArtifacts();
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: tokenUsage } = useTokenUsage();
  const invalidateTokenUsage = useInvalidateTokenUsage();
  const { showFromError } = useTokenExhaustion();
  const tokensExhausted = tokenUsage && !tokenUsage.unlimited && tokenUsage.available <= 0;

  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<OrchestratorApproval | null>(null);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const { speak, stop: stopSpeaking } = useSpeechSynthesis();
  const lastSpokenRef = useRef<string | null>(null);
  const [convListening, setConvListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const conversationModeRef = useRef(conversationMode);
  const pendingRef = useRef(pending);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const handleSendRef = useRef<(text?: string) => Promise<void>>(async () => {});

  const {
    isSupported: sttSupported,
    startListening: startConvListening,
    stopListening: stopConvListening,
  } = useSpeechRecognition({
    continuous: true,
    onResult: (text, isFinal) => {
      if (!conversationModeRef.current) return;
      if (isFinal && text.trim() && !pendingRef.current) {
        setInterimTranscript("");
        setConvListening(false);
        stopConvListening();
        void handleSendRef.current(text);
      } else if (!isFinal) {
        setInterimTranscript(text);
      }
    },
    onError: () => setConvListening(false),
  });

  const threadsQuery = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId) : ["orchestrator", "threads", "none"],
    queryFn: () => OrchestratorService.listThreads(currentSiteId as string, 30),
    enabled: !!currentSiteId,
    refetchOnWindowFocus: false,
  });

  const threadQuery = useQuery({
    queryKey:
      currentSiteId && threadId
        ? QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, threadId)
        : ["orchestrator", "thread", "none"],
    queryFn: () => OrchestratorService.getThread(currentSiteId as string, threadId as string),
    enabled: !!currentSiteId && !!threadId,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    orchestratorTracker.opened();
  }, []);

  useEffect(() => {
    if (threadQuery.data?.thread?.is_onboarding) {
      setSetupInterviewActive(true);
    }
  }, [threadQuery.data?.thread?.is_onboarding, setSetupInterviewActive]);

  useEffect(() => {
    setOptimisticMessages([]);
    setPending(null);
    setError(null);
    setPendingApproval(null);
    setEditingThreadId(null);
    setEditTitle("");
    setRenameError(null);
    prevMessageCountRef.current = 0;
    clearLivePhase();
  }, [threadId, clearLivePhase]);

  const renameThreadMutation = useMutation({
    mutationFn: ({ threadId: id, title }: { threadId: string; title: string }) =>
      OrchestratorService.renameThread(currentSiteId as string, id, title),
    onSuccess: (updated) => {
      if (!currentSiteId) return;
      setEditingThreadId(null);
      setEditTitle("");
      setRenameError(null);
      queryClient.setQueryData(
        QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, updated._id),
        (old: { thread: { title: string }; messages: unknown[] } | undefined) =>
          old ? { ...old, thread: { ...old.thread, title: updated.title } } : old
      );
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId),
      });
    },
    onError: (err: unknown) => {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setRenameError(apiMessage ?? "Could not rename conversation.");
    },
  });

  useEffect(() => {
    if (editingThreadId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingThreadId]);

  const activeThreadTitle =
    threadQuery.data?.thread?.title ?? threadsQuery.data?.find((t) => t._id === threadId)?.title ?? "New conversation";

  const startRenameThread = (id: string, currentTitle: string) => {
    if (pending) return;
    setEditingThreadId(id);
    setEditTitle(currentTitle || "New conversation");
    setRenameError(null);
    renameThreadMutation.reset();
  };

  const cancelRename = () => {
    setEditingThreadId(null);
    setEditTitle("");
    setRenameError(null);
    renameThreadMutation.reset();
  };

  const submitRename = () => {
    if (!editingThreadId || !currentSiteId) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setRenameError("Name cannot be empty");
      return;
    }
    const original =
      threadsQuery.data?.find((t) => t._id === editingThreadId)?.title ??
      (editingThreadId === threadId ? activeThreadTitle : "");
    if ((original || "New conversation") === trimmed) {
      cancelRename();
      return;
    }
    setRenameError(null);
    renameThreadMutation.mutate({ threadId: editingThreadId, title: trimmed });
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  useEffect(() => {
    const latest = threadQuery.data?.messages?.find((m) => m.role === "assistant" && m.pending_approval_id);
    if (!latest) {
      setPendingApproval((prev) => (prev?.id ? null : prev));
    }
  }, [threadQuery.data]);

  const combinedMessages = useMemo<OptimisticMessage[]>(() => {
    const msgs = threadQuery.data?.messages ?? [];
    const threadMoatByAssistant = new Map<string, V05MoatSnapshot>();
    // Attribute research/optimize tool_calls on an assistant message to that bubble.
    for (const m of msgs) {
      if (m.role !== "assistant") continue;
      const moat = extractMoatSnapshot({ messages: [m] });
      if (moat) threadMoatByAssistant.set(m._id, moat);
    }
    // Also scan preceding tool messages' sibling assistant — tool_calls live on assistant in v05.
    const persisted: OptimisticMessage[] = msgs.map((m: OrchestratorMessage) => {
      const toolArtifactId =
        m.role === "tool" ? findArtifactIdForToolMessage(m.tool_name, m.content, artifacts) : undefined;
      const assistantArtifactId = m.role === "assistant" ? findArtifactIdForAssistantMessage(m, artifacts) : undefined;
      return {
        id: m._id,
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
        toolName: m.tool_name,
        artifactId: toolArtifactId ?? assistantArtifactId,
        moat: m.role === "assistant" ? (threadMoatByAssistant.get(m._id) ?? null) : null,
      };
    });
    return [...persisted, ...optimisticMessages];
  }, [threadQuery.data, optimisticMessages, artifacts]);

  const handleViewArtifact = (artifactId: string) => {
    openResultsPanel(artifactId);
    onShowMobileArtifacts?.();
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const count = combinedMessages.length + (pending ? 1 : 0);
    const shouldScroll =
      pending !== null || count > prevMessageCountRef.current || (count > 0 && prevMessageCountRef.current === 0);
    prevMessageCountRef.current = count;
    if (!shouldScroll) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [combinedMessages.length, pending]);

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

    const explicitMode = parseExplicitSessionModeSwitch(text);
    if (explicitMode) {
      setSessionMode(explicitMode);
      if (explicitMode !== "auto") {
        setEffectiveSessionMode(explicitMode);
      }
    }

    if (isWritingEffectiveMode(sessionMode, effectiveSessionMode) || explicitMode === "writing") {
      setDraftGenerating(true);
    }

    orchestratorTracker.messageSent({ thread_id: threadId ?? undefined });
    const effectiveSelectionContext =
      selectionContext ??
      (activeDraftBlogId
        ? {
            blogId: activeDraftBlogId,
            blogTitle: "Current draft",
            referenceType: "blog" as const,
          }
        : undefined);
    const sendStartedAt = Date.now();
    const useOnboardingInterview =
      setupInterviewActive || Boolean(threadQuery.data?.thread?.is_onboarding);
    try {
      const res: ChatTurnResponse = useOnboardingInterview
        ? await OrchestratorService.onboardingChat(currentSiteId, text)
        : await OrchestratorService.chat(currentSiteId, text, threadId ?? undefined, {
            sessionMode: explicitMode ?? sessionMode,
            attachments: pendingAttachments.length ? pendingAttachments : undefined,
            selectionContext: effectiveSelectionContext,
            conversationMode: conversationModeRef.current || undefined,
          });

      if (res.active_session_mode) {
        setEffectiveSessionMode(res.active_session_mode);
      }
      if (res.session_mode_source === "explicit" && explicitMode && explicitMode !== "auto") {
        setSessionMode(explicitMode);
      }

      const newOptimistic: OptimisticMessage[] = [];
      const newLiveArtifacts: OrchestratorArtifact[] = [];
      for (const call of res.tool_calls ?? []) {
        orchestratorTracker.toolExecuted({ tool_name: call.tool, thread_id: res.thread_id });
        const liveId = `live-${Date.now()}-${newLiveArtifacts.length}`;
        if (call.output_data && typeof call.output_data === "object") {
          const outputData = call.output_data as Record<string, unknown>;
          newLiveArtifacts.push({
            id: liveId,
            tool: call.tool,
            summary: call.summary,
            outputData,
          });
          const blogId = extractBlogIdFromArtifactData(outputData);
          if (blogId && DRAFT_ARTIFACT_TOOLS.has(call.tool)) {
            setActiveDraftBlogId(blogId);
            const patched = patchBlogCacheFromToolOutput(queryClient, blogId, {
              ...outputData,
              content:
                typeof outputData.content === "string"
                  ? outputData.content
                  : typeof outputData.content_html === "string"
                    ? outputData.content_html
                    : outputData.content,
            });
            if (!patched) {
              void queryClient.refetchQueries({ queryKey: QUERY_KEYS.BLOG(blogId) });
            } else {
              void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(blogId) });
            }
          } else if (call.tool === "blogs.get" && blogId) {
            void queryClient.refetchQueries({ queryKey: QUERY_KEYS.BLOG(blogId) });
          }
        }
        newOptimistic.push({
          id: `tool-${Date.now()}-${newOptimistic.length}`,
          role: "tool",
          content: call.summary,
          toolName: call.tool,
          artifactId: call.output_data ? liveId : undefined,
        });
      }
      if (newLiveArtifacts.length > 0) {
        mergeLiveArtifacts(newLiveArtifacts);
        const preferred =
          [...newLiveArtifacts].reverse().find((a) => DRAFT_ARTIFACT_TOOLS.has(a.tool)) ??
          [...newLiveArtifacts].reverse().find((a) => a.tool === "blogs.review") ??
          [...newLiveArtifacts].reverse().find((a) => VIEWABLE_ARTIFACT_TOOLS.has(a.tool)) ??
          newLiveArtifacts[newLiveArtifacts.length - 1];
        const hasViewable = newLiveArtifacts.some((a) => VIEWABLE_ARTIFACT_TOOLS.has(a.tool));
        // Only open for blog/list/research-style artifacts — never for chat skills.
        if (hasViewable) {
          openResultsPanel(preferred?.id);
          onShowMobileArtifacts?.();
        }
      }
      clearPendingAttachments();
      newOptimistic.push({
        id: res.assistant_message.id,
        role: "assistant",
        content: res.assistant_message.content,
        artifactId: newLiveArtifacts.length > 0 ? newLiveArtifacts[newLiveArtifacts.length - 1]?.id : undefined,
        moat: extractMoatSnapshot({ v05: res.v05_graph, toolCalls: res.tool_calls }),
      });
      if (voiceMode && res.assistant_message.content !== lastSpokenRef.current) {
        lastSpokenRef.current = res.assistant_message.content;
        if (conversationModeRef.current) {
          setIsSpeaking(true);
          speak(res.assistant_message.content, () => {
            setIsSpeaking(false);
            if (conversationModeRef.current && sttSupported && !pendingRef.current) {
              startConvListening();
              setConvListening(true);
            }
          });
        } else {
          speak(res.assistant_message.content);
        }
      }
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
      if (useOnboardingInterview) {
        void queryClient.invalidateQueries({
          queryKey: ["onboarding", "setup-progress", currentSiteId],
        });
      }
      if (useOnboardingInterview && res.onboarding_completed) {
        setSetupInterviewActive(false);
      }
      if (res.pending_approval) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId),
        });
      }
      invalidateTokenUsage();
    } catch (e: unknown) {
      if (showFromError(e)) {
        invalidateTokenUsage();
        setError("Daily AI token limit reached.");
      } else {
        const err = e as { response?: { status?: number; data?: { message?: string; code?: string } } };
        const apiMessage = err?.response?.data?.message;
        const apiCode = err?.response?.data?.code;
        if (err?.response?.status === 409 && apiCode === "AI_REQUEST_IN_PROGRESS") {
          setError("A previous AI request is still finishing. Wait a moment, then try again.");
        } else {
          setError(apiMessage ?? "Something went wrong. Please try again.");
        }
      }
      setOptimisticMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      if (!overrideText) setInput(text);
    } finally {
      setPending(null);
      setDraftGenerating(false);
      clearLivePhase();
    }
  };

  const handleNewThread = () => {
    clearLiveArtifacts();
    setThreadId(null);
    setSetupInterviewActive(false);
    setOptimisticMessages([]);
    setPendingApproval(null);
    setError(null);
    cancelRename();
  };

  handleSendRef.current = handleSend;

  useEffect(() => {
    if (!conversationMode) {
      stopConvListening();
      stopSpeaking();
      setConvListening(false);
      setInterimTranscript("");
      setIsSpeaking(false);
      return;
    }
    if (sttSupported && !pending && !isSpeaking) {
      const timer = setTimeout(() => {
        startConvListening();
        setConvListening(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [conversationMode, sttSupported, pending, isSpeaking, startConvListening, stopConvListening, stopSpeaking]);

  const handleEndConversation = () => {
    stopConvListening();
    stopSpeaking();
    setConvListening(false);
    setInterimTranscript("");
    setIsSpeaking(false);
    exitConversationMode();
  };

  const handleConvMicToggle = () => {
    if (convListening) {
      stopConvListening();
      setConvListening(false);
    } else if (!pending && !isSpeaking) {
      startConvListening();
      setConvListening(true);
    }
  };

  const lastUserMessage = useMemo(() => {
    return [...combinedMessages].reverse().find((m) => m.role === "user")?.content;
  }, [combinedMessages]);

  const lastAssistantMessage = useMemo(() => {
    return [...combinedMessages].reverse().find((m) => m.role === "assistant")?.content;
  }, [combinedMessages]);

  const conversationStatus: ConversationStatus = isSpeaking
    ? "speaking"
    : pending
      ? "thinking"
      : convListening
        ? "listening"
        : "idle";

  if (conversationMode) {
    return (
      <div className={cn("flex flex-col min-w-0 h-full", className)}>
        <FullConversationView
          threadTitle={threadId ? activeThreadTitle : "New conversation"}
          sessionMode={sessionMode}
          effectiveSessionMode={effectiveSessionMode}
          onSessionModeChange={setSessionMode}
          status={conversationStatus}
          interimTranscript={interimTranscript}
          lastUserMessage={lastUserMessage}
          lastAssistantMessage={lastAssistantMessage}
          isListening={convListening}
          sttSupported={sttSupported}
          disabled={!!pending || !currentSiteId || tokensExhausted}
          error={error}
          hasResults={hasArtifacts}
          onViewResults={() => {
            openResultsPanel(artifacts[artifacts.length - 1]?.id);
            onShowMobileArtifacts?.();
          }}
          onMicToggle={handleConvMicToggle}
          onEndCall={handleEndConversation}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col min-w-0 h-full bg-black", className)}>
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            {threadId && editingThreadId === threadId ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    disabled={renameThreadMutation.isPending}
                    aria-label="Conversation name"
                    className="flex-1 min-w-0 max-w-xs px-2 py-1 text-sm font-semibold bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-primary disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={submitRename}
                    disabled={renameThreadMutation.isPending}
                    aria-label="Save conversation name"
                    className="p-1 rounded text-primary hover:bg-gray-800 disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={renameThreadMutation.isPending}
                    aria-label="Cancel rename"
                    className="p-1 rounded text-gray-400 hover:bg-gray-800 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                {renameError && (
                  <p className="text-xs text-red-400" role="alert">
                    {renameError}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                <p className="text-sm font-semibold truncate">{threadId ? activeThreadTitle : "New conversation"}</p>
                {threadId && (
                  <button
                    type="button"
                    onClick={() => startRenameThread(threadId, activeThreadTitle)}
                    disabled={!!pending}
                    aria-label="Rename conversation"
                    className="shrink-0 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-gray-500">Workspace orchestrator</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasArtifacts && (
            <button
              type="button"
              onClick={() => {
                if (showResultsPanel && mobileArtifactsOpen) {
                  onToggleMobileArtifacts?.();
                  return;
                }
                if (!showResultsPanel) {
                  openResultsPanel(artifacts[artifacts.length - 1]?.id);
                }
                onShowMobileArtifacts?.();
              }}
              className={cn(
                "flex items-center gap-1 text-xs border rounded-md px-2 py-1 transition-colors",
                showResultsPanel || mobileArtifactsOpen
                  ? "border-primary/50 text-primary bg-primary/10"
                  : "border-gray-800 text-gray-300 hover:text-white"
              )}
              aria-label={showResultsPanel ? "Show results panel" : "Open results panel"}
            >
              <PanelRight className="w-3.5 h-3.5" aria-hidden="true" />
              {showResultsPanel || mobileArtifactsOpen ? "Results" : "View results"}
            </button>
          )}
          <button
            onClick={handleNewThread}
            aria-label="Start new conversation"
            className="flex items-center gap-1 text-xs text-gray-300 hover:text-white border border-gray-800 rounded-md px-2 py-1"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> New
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-6 space-y-4 max-w-4xl w-full mx-auto [scrollbar-gutter:stable]"
      >
        {!threadId && combinedMessages.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30 mb-4">
              <Sparkles className="w-7 h-7 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold">How can I help today?</h2>
            <p className="text-sm text-gray-400 mt-2 max-w-lg mx-auto">
              Ask me to draft a blog post, list scheduled content, create a category, or look up performance for this
              workspace. I&apos;ll confirm any destructive actions before running them.
            </p>
          </div>
        )}
        {threadQuery.isLoading && threadId && <p className="text-xs text-gray-500">Loading conversation…</p>}
        {combinedMessages.map((m) => (
          <ChatMessage
            key={m.id}
            role={m.role}
            content={m.content}
            toolName={m.toolName}
            artifactId={m.artifactId}
            onViewArtifact={handleViewArtifact}
            moat={m.moat}
          />
        ))}
        {pending && (
          <ThinkingIndicator
            label={
              livePhase?.message
                ? livePhase.percent != null
                  ? `${livePhase.message} (${livePhase.percent}%)`
                  : livePhase.message
                : "Thinking"
            }
          />
        )}
        {error && (
          <div className="rounded-md bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-200">{error}</div>
        )}
        {pendingApproval && (
          <div className="rounded-xl border border-yellow-700/60 bg-yellow-900/20 p-4">
            <p className="text-sm font-medium text-yellow-100">Confirmation needed: {pendingApproval.action}</p>
            <p className="text-xs text-yellow-200/80 mt-1">{pendingApproval.summary}</p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => {
                  orchestratorTracker.approvalDecided({
                    decision: "approved",
                    tool_name: pendingApproval.action,
                  });
                  handleSend("yes");
                }}
                disabled={!!pending}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  orchestratorTracker.approvalDecided({
                    decision: "rejected",
                    tool_name: pendingApproval.action,
                  });
                  handleSend("no");
                }}
                disabled={!!pending}
                className="border-gray-700 text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 py-3 border-t border-gray-800 max-w-4xl w-full mx-auto shrink-0">
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => handleSend()}
          disabled={!!pending || !currentSiteId || tokensExhausted}
          autoFocus
          onOpenKnowledgeBase={() => setKnowledgeOpen(true)}
          placeholder={
            tokensExhausted
              ? "Daily AI token limit reached — resets when your window rolls over"
              : "Ask the orchestrator to act on this workspace..."
          }
        />
        <p className="mt-2 text-xs text-gray-500">
          Destructive actions (delete, publish, unpublish) always ask for an in-chat confirmation before running.
        </p>
      </div>

      <KnowledgeBaseModal open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />
    </div>
  );
}
