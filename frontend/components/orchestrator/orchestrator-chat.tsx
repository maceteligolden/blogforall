"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { WritingStageRail } from "./writing-stage-rail";
import { ResearchFindingsCard } from "./research-findings-card";
import { OutlineApprovalCard } from "./outline-approval-card";
import { extractOutlineCardProps, extractResearchCardProps, findActiveWritingHitl } from "@/lib/utils/writing-hitl";
import { useOrchestrator } from "./orchestrator-provider";
import { useTokenUsage, useInvalidateTokenUsage } from "@/lib/hooks/use-token-usage";
import { useTokenExhaustion } from "@/components/usage/token-exhaustion-provider";
import { orchestratorTracker } from "@/lib/analytics/flows/orchestrator.tracker";
import {
  findArtifactIdForAssistantMessage,
  findArtifactIdForToolMessage,
  extractBlogIdFromArtifactData,
  DRAFT_ARTIFACT_TOOLS,
  ENTITY_PANEL_TOOLS,
  artifactHasEntityId,
  entityViewCtaLabel,
  patchBlogCacheFromToolOutput,
  type OrchestratorArtifact,
} from "@/lib/utils/orchestrator-artifacts";
import { extractMoatSnapshot } from "@/lib/utils/moat-snapshot";
import { parseExplicitSessionModeSwitch, isWritingEffectiveMode } from "@/lib/utils/session-mode-parser";
import { BUSINESS_REFINE_PROMPT_KEY } from "@/lib/onboarding/brand-setup-items";
import { useOrchestratorArtifacts } from "@/lib/hooks/use-orchestrator-artifacts";
import { useRenameThread } from "@/lib/hooks/use-rename-thread";
import { useSpeechSynthesis } from "@/lib/hooks/use-speech-synthesis";
import { useElevenLabsTts } from "@/lib/hooks/use-elevenlabs-tts";
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
  artifactTool?: string;
  hasDraftEntity?: boolean;
  viewCtaLabel?: string | null;
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
    closeResultsPanel,
    conversationMode,
    exitConversationMode,
    livePhase,
    livePhaseHistory,
    clearLivePhase,
    setupInterviewActive,
    setSetupInterviewActive,
  } = useOrchestrator();
  const { artifacts, hasViewableArtifacts, showResultsPanel } = useOrchestratorArtifacts();
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
  const [lastTurnToolCalls, setLastTurnToolCalls] = useState<
    Array<{ tool: string; summary: string; output_data?: Record<string, unknown> }>
  >([]);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const prevMessageCountRef = useRef(0);
  const { speak: browserSpeak, stop: stopBrowserSpeaking } = useSpeechSynthesis();
  const { speak: elevenSpeak, stop: stopElevenSpeaking, whenIdle: whenElevenIdle } = useElevenLabsTts(currentSiteId);
  const lastSpokenRef = useRef<string | null>(null);
  const [convListening, setConvListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const conversationModeRef = useRef(conversationMode);
  const pendingRef = useRef(pending);
  const openThreadInFlightRef = useRef(false);
  const openedThreadKeyRef = useRef<string | null>(null);

  const stopSpeaking = () => {
    stopElevenSpeaking();
    stopBrowserSpeaking();
  };

  useEffect(() => {
    conversationModeRef.current = conversationMode;
  }, [conversationMode]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prompt = sessionStorage.getItem(BUSINESS_REFINE_PROMPT_KEY);
    if (!prompt?.trim()) return;
    sessionStorage.removeItem(BUSINESS_REFINE_PROMPT_KEY);
    setInput(prompt.trim());
  }, []);

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

  // Proactive opener: new thread or empty thread with 0 messages.
  useEffect(() => {
    if (!currentSiteId || setupInterviewActive) {
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
        body: JSON.stringify({
          sessionId: "17457c",
          runId: "pre-fix",
          hypothesisId: "H-D",
          location: "orchestrator-chat.tsx:opener",
          message: "opener skipped early",
          data: { hasSite: !!currentSiteId, setupInterviewActive },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    if (openThreadInFlightRef.current) return;

    const needsNewThread = !threadId;
    const threadLoadedEmpty = !!threadId && threadQuery.isSuccess && (threadQuery.data?.messages?.length ?? 0) === 0;
    if (!needsNewThread && !threadLoadedEmpty) {
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
        body: JSON.stringify({
          sessionId: "17457c",
          runId: "pre-fix",
          hypothesisId: "H-D",
          location: "orchestrator-chat.tsx:opener",
          message: "opener skipped not empty",
          data: {
            threadId,
            isSuccess: threadQuery.isSuccess,
            msgCount: threadQuery.data?.messages?.length ?? 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }

    const key = needsNewThread ? `${currentSiteId}:new` : `${currentSiteId}:${threadId}`;
    if (openedThreadKeyRef.current === key) return;

    openThreadInFlightRef.current = true;
    openedThreadKeyRef.current = key;
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
      body: JSON.stringify({
        sessionId: "17457c",
        runId: "pre-fix",
        hypothesisId: "H-D",
        location: "orchestrator-chat.tsx:opener",
        message: "opener calling openThread",
        data: { key, needsNewThread, threadId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    void OrchestratorService.openThread(currentSiteId, threadId ?? undefined)
      .then((res) => {
        // #region agent log
        fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
          body: JSON.stringify({
            sessionId: "17457c",
            runId: "pre-fix",
            hypothesisId: "H-D",
            location: "orchestrator-chat.tsx:opener",
            message: "opener success",
            data: {
              thread_id: res.thread_id,
              hasAssistant: Boolean(res.assistant_message?.content),
              preview: (res.assistant_message?.content ?? "").slice(0, 80),
              priority: res.priority,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (threadId !== res.thread_id) {
          setThreadId(res.thread_id);
        }
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId),
        });
        void queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, res.thread_id),
        });
      })
      .catch((err) => {
        // #region agent log
        fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
          body: JSON.stringify({
            sessionId: "17457c",
            runId: "pre-fix",
            hypothesisId: "H-D",
            location: "orchestrator-chat.tsx:opener",
            message: "opener failed",
            data: { err: String(err) },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        // Allow retry on next relevant state change.
        openedThreadKeyRef.current = null;
      })
      .finally(() => {
        openThreadInFlightRef.current = false;
      });
  }, [
    currentSiteId,
    threadId,
    threadQuery.isSuccess,
    threadQuery.data?.messages?.length,
    setupInterviewActive,
    setThreadId,
    queryClient,
  ]);

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

  const renameThreadMutation = useRenameThread(currentSiteId);

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
    renameThreadMutation.mutate(
      { threadId: editingThreadId, title: trimmed },
      {
        onSuccess: () => {
          setEditingThreadId(null);
          setEditTitle("");
          setRenameError(null);
        },
        onError: (err: unknown) => {
          const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          setRenameError(apiMessage ?? "Could not rename conversation.");
        },
      }
    );
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

  // Drop optimistic rows once the same turn is in persisted history (single message lifecycle).
  useEffect(() => {
    const msgs = threadQuery.data?.messages ?? [];
    if (!msgs.length || !optimisticMessages.length) return;
    const persistedIds = new Set(msgs.map((m) => m._id));
    setOptimisticMessages((prev) =>
      prev.filter((m) => {
        if (persistedIds.has(m.id)) return false;
        if (m.id.startsWith("local-") && m.role === "user") {
          return !msgs.some((p) => p.role === "user" && p.content === m.content);
        }
        if (m.role === "tool") {
          return !msgs.some((p) => p.role === "tool" && p.tool_name === m.toolName && p.content === m.content);
        }
        return true;
      })
    );
  }, [threadQuery.data?.messages]);

  const combinedMessages = useMemo<OptimisticMessage[]>(() => {
    const msgs = threadQuery.data?.messages ?? [];
    const threadMoatByAssistant = new Map<string, V05MoatSnapshot>();
    for (const m of msgs) {
      if (m.role !== "assistant") continue;
      const moat = extractMoatSnapshot({ messages: [m] });
      if (moat) threadMoatByAssistant.set(m._id, moat);
    }
    const persistedIds = new Set(msgs.map((m) => m._id));
    const persistedContents = new Set(msgs.filter((m) => m.role === "user").map((m) => m.content));
    const persisted: OptimisticMessage[] = msgs.map((m: OrchestratorMessage) => {
      const toolArtifactId =
        m.role === "tool" ? findArtifactIdForToolMessage(m.tool_name, m.content, artifacts) : undefined;
      const assistantArtifactId = m.role === "assistant" ? findArtifactIdForAssistantMessage(m, artifacts) : undefined;
      const artifactId = toolArtifactId ?? assistantArtifactId;
      const matched = artifactId ? artifacts.find((a) => a.id === artifactId) : undefined;
      const artifactTool =
        matched?.tool ??
        (m.role === "assistant" ? m.tool_calls?.find((c) => ENTITY_PANEL_TOOLS.has(c.tool))?.tool : m.tool_name);
      const hasDraft =
        !!matched && DRAFT_ARTIFACT_TOOLS.has(matched.tool) && !!extractBlogIdFromArtifactData(matched.outputData);
      return {
        id: m._id,
        role: m.role === "system" ? "assistant" : m.role,
        content: m.content,
        toolName: m.tool_name,
        artifactId,
        artifactTool,
        hasDraftEntity: hasDraft,
        viewCtaLabel: matched && artifactHasEntityId(matched) ? entityViewCtaLabel(matched.tool) : null,
        moat: m.role === "assistant" ? (threadMoatByAssistant.get(m._id) ?? null) : null,
      };
    });
    const pendingOptimistic = optimisticMessages.filter((m) => {
      if (persistedIds.has(m.id)) return false;
      if (m.id.startsWith("local-") && m.role === "user" && persistedContents.has(m.content)) return false;
      if (m.role === "tool") {
        return !msgs.some((p) => p.role === "tool" && p.tool_name === m.toolName && p.content === m.content);
      }
      return true;
    });
    return [...persisted, ...pendingOptimistic];
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
    setLastTurnToolCalls([]);
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
    const useOnboardingInterview = setupInterviewActive || Boolean(threadQuery.data?.thread?.is_onboarding);
    const chatOptions = {
      sessionMode: explicitMode ?? sessionMode,
      attachments: pendingAttachments.length ? pendingAttachments : undefined,
      selectionContext: effectiveSelectionContext,
      conversationMode: conversationModeRef.current || undefined,
    };
    try {
      let res: ChatTurnResponse;
      if (useOnboardingInterview) {
        res = await OrchestratorService.onboardingChat(currentSiteId, text);
      } else if (conversationModeRef.current) {
        res = await OrchestratorService.chatStream(currentSiteId, text, threadId ?? undefined, {
          ...chatOptions,
          conversationMode: true,
          onSentence: (sentence) => {
            setIsSpeaking(true);
            elevenSpeak(sentence);
          },
        });
      } else {
        res = await OrchestratorService.chat(currentSiteId, text, threadId ?? undefined, chatOptions);
      }

      if (res.active_session_mode) {
        setEffectiveSessionMode(res.active_session_mode);
      }
      if (res.session_mode_source === "explicit" && explicitMode && explicitMode !== "auto") {
        setSessionMode(explicitMode);
      }

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
        // Do not invent tool chat bubbles — persisted history (or assistant tool_calls) is source of truth.
      }
      if (newLiveArtifacts.length > 0) {
        mergeLiveArtifacts(newLiveArtifacts);
        const entityArts = newLiveArtifacts.filter((a) => ENTITY_PANEL_TOOLS.has(a.tool) && artifactHasEntityId(a));
        const preferred =
          [...entityArts].reverse().find((a) => DRAFT_ARTIFACT_TOOLS.has(a.tool)) ??
          [...entityArts].reverse().find((a) => a.tool === "blogs.review") ??
          [...entityArts].reverse()[0];
        if (preferred) {
          openResultsPanel(preferred.id);
          onShowMobileArtifacts?.();
        }
        for (const call of res.tool_calls ?? []) {
          if (call.tool === "blogs.delete") {
            const deletedId =
              typeof call.output_data === "object" && call.output_data
                ? extractBlogIdFromArtifactData(call.output_data as Record<string, unknown>)
                : undefined;
            if (deletedId && deletedId === activeDraftBlogId) {
              setActiveDraftBlogId(null);
              closeResultsPanel();
            }
          }
        }
      }
      clearPendingAttachments();
      const panelArt = [...newLiveArtifacts]
        .reverse()
        .find((a) => ENTITY_PANEL_TOOLS.has(a.tool) && artifactHasEntityId(a));
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
        body: JSON.stringify({
          sessionId: "17457c",
          runId: "pre-fix",
          hypothesisId: "H-A",
          location: "orchestrator-chat.tsx:handleSend",
          message: "cta assignment after turn",
          data: {
            tools: (res.tool_calls ?? []).map((c) => c.tool),
            panelArtTool: panelArt?.tool ?? null,
            panelArtId: panelArt?.id ?? null,
            viewCta: panelArt ? entityViewCtaLabel(panelArt.tool) : null,
            openedPanel: Boolean(
              newLiveArtifacts.some((a) => ENTITY_PANEL_TOOLS.has(a.tool) && artifactHasEntityId(a))
            ),
            pendingApproval: res.pending_approval?.action ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      // Keep local user bubble until refetch; assistant only (no synthetic tool rows).
      setOptimisticMessages((prev) => [
        ...prev.filter((m) => m.id.startsWith("local-")),
        {
          id: res.assistant_message.id,
          role: "assistant",
          content: res.assistant_message.content,
          artifactId: panelArt?.id,
          artifactTool: panelArt?.tool,
          hasDraftEntity: panelArt
            ? DRAFT_ARTIFACT_TOOLS.has(panelArt.tool) && !!extractBlogIdFromArtifactData(panelArt.outputData)
            : false,
          viewCtaLabel: panelArt ? entityViewCtaLabel(panelArt.tool) : null,
          moat: extractMoatSnapshot({ v05: res.v05_graph, toolCalls: res.tool_calls }),
        },
      ]);
      if (voiceMode && res.assistant_message.content !== lastSpokenRef.current) {
        lastSpokenRef.current = res.assistant_message.content;
        if (conversationModeRef.current) {
          // Sentences were already queued via chatStream onSentence; wait for queue idle.
          whenElevenIdle(() => {
            setIsSpeaking(false);
            if (conversationModeRef.current && sttSupported && !pendingRef.current) {
              startConvListening();
              setConvListening(true);
            }
          });
        } else {
          browserSpeak(res.assistant_message.content);
        }
      } else if (conversationModeRef.current) {
        whenElevenIdle(() => {
          setIsSpeaking(false);
          if (conversationModeRef.current && sttSupported && !pendingRef.current) {
            startConvListening();
            setConvListening(true);
          }
        });
      }
      setPendingApproval(res.pending_approval);
      setLastTurnToolCalls(res.tool_calls ?? []);
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
      stopSpeaking();
      setIsSpeaking(false);
      if (showFromError(e)) {
        invalidateTokenUsage();
        setError("Daily AI token limit reached.");
      } else {
        const err = e as {
          response?: { status?: number; data?: { message?: string; code?: string } };
          message?: string;
        };
        const apiMessage = err?.response?.data?.message ?? err?.message;
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
    openedThreadKeyRef.current = null;
    setThreadId(null);
    setSetupInterviewActive(false);
    setOptimisticMessages([]);
    setPendingApproval(null);
    setLastTurnToolCalls([]);
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

  const activeWritingHitl = useMemo(() => {
    if (lastTurnToolCalls.length) {
      const synthetic: OrchestratorMessage = {
        _id: "live-hitl",
        thread_id: threadId ?? "",
        site_id: currentSiteId ?? "",
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        tool_calls: lastTurnToolCalls.map((c) => ({
          tool: c.tool,
          output_summary: c.summary,
          output_data: c.output_data,
        })),
      };
      const live = findActiveWritingHitl([synthetic]);
      if (live) return live;
    }
    return findActiveWritingHitl(threadQuery.data?.messages ?? []);
  }, [threadQuery.data?.messages, lastTurnToolCalls, threadId, currentSiteId]);

  const researchCardProps =
    activeWritingHitl?.kind === "research" ? extractResearchCardProps(activeWritingHitl.output) : null;
  const outlineCardProps =
    activeWritingHitl?.kind === "outline" ? extractOutlineCardProps(activeWritingHitl.output) : null;

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
      body: JSON.stringify({
        sessionId: "17457c",
        runId: "post-fix",
        hypothesisId: "H-C",
        location: "orchestrator-chat.tsx:hitl",
        message: "hitl card state",
        data: {
          hitlKind: activeWritingHitl?.kind ?? null,
          hasResearchCard: Boolean(researchCardProps),
          hasOutlineCard: Boolean(outlineCardProps),
          lastTools: lastTurnToolCalls.map((c) => c.tool),
          conversationMode,
          pending: Boolean(pending),
          activeDraftBlogId,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [
    activeWritingHitl?.kind,
    researchCardProps,
    outlineCardProps,
    lastTurnToolCalls,
    conversationMode,
    pending,
    activeDraftBlogId,
  ]);
  // #endregion

  if (conversationMode) {
    const voiceWorkflowActions =
      researchCardProps && !pending
        ? [
            { label: "Approve research", onClick: () => void handleSend("Approve the research") },
            { label: "Revise research", onClick: () => void handleSend("Revise the research") },
            { label: "Continue", onClick: () => void handleSend("Continue") },
          ]
        : outlineCardProps && !pending
          ? [
              { label: "Approve outline", onClick: () => void handleSend("Approve the outline") },
              { label: "Modify outline", onClick: () => void handleSend("Modify the outline") },
              { label: "Continue", onClick: () => void handleSend("Continue") },
            ]
          : undefined;

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
          hasResults={hasViewableArtifacts}
          onViewResults={() => {
            openResultsPanel(artifacts[artifacts.length - 1]?.id);
            onShowMobileArtifacts?.();
          }}
          workflowActions={voiceWorkflowActions}
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
          {hasViewableArtifacts && (
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
            artifactTool={m.artifactTool}
            hasDraftEntity={m.hasDraftEntity}
            viewCtaLabel={m.viewCtaLabel}
            onViewArtifact={handleViewArtifact}
            moat={m.moat}
          />
        ))}
        {pending && livePhaseHistory.length > 0 && <WritingStageRail phases={livePhaseHistory} className="mx-0" />}
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
        {researchCardProps && !pending && (
          <ResearchFindingsCard
            {...researchCardProps}
            disabled={!!pending}
            onApprove={() => handleSend("Approve the research")}
            onRevise={() => handleSend("Revise the research")}
            onContinue={() => handleSend("Continue")}
          />
        )}
        {outlineCardProps && !pending && (
          <OutlineApprovalCard
            {...outlineCardProps}
            disabled={!!pending}
            onApprove={() => handleSend("Approve the outline")}
            onModify={() => handleSend("Modify the outline")}
            onContinue={() => handleSend("Continue")}
          />
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
          placeholder={
            tokensExhausted
              ? "Daily AI token limit reached — resets when your window rolls over"
              : "Ask your content strategist…"
          }
        />
        <p className="mt-2 text-xs text-gray-500">
          Destructive actions (delete, publish, unpublish) always ask for an in-chat confirmation before running.
        </p>
      </div>
    </div>
  );
}
