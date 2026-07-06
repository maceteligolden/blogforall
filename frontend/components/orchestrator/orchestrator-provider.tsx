"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { OrchestratorArtifact } from "@/lib/utils/orchestrator-artifacts";
import type {
  OperationalSessionMode,
  OrchestratorChatAttachment,
  OrchestratorSelectionContext,
  OrchestratorSessionMode,
} from "@/lib/types/orchestrator-session.types";
import { isWritingEffectiveMode } from "@/lib/utils/session-mode-parser";
import { useAuthStore } from "@/lib/store/auth.store";

interface OrchestratorContextValue {
  threadId: string | null;
  setThreadId: (threadId: string | null) => void;
  liveArtifacts: OrchestratorArtifact[];
  addLiveArtifacts: (artifacts: OrchestratorArtifact[]) => void;
  mergeLiveArtifacts: (artifacts: OrchestratorArtifact[]) => void;
  clearLiveArtifacts: () => void;
  sessionMode: OrchestratorSessionMode;
  setSessionMode: (mode: OrchestratorSessionMode) => void;
  effectiveSessionMode: OperationalSessionMode;
  setEffectiveSessionMode: (mode: OperationalSessionMode) => void;
  isWritingPinned: boolean;
  draftGenerating: boolean;
  setDraftGenerating: (value: boolean) => void;
  activeDraftBlogId: string | null;
  setActiveDraftBlogId: (blogId: string | null) => void;
  selectionContext: OrchestratorSelectionContext | null;
  setSelectionContext: (ctx: OrchestratorSelectionContext | null) => void;
  composerFocusRef: React.MutableRefObject<(() => void) | null>;
  focusComposer: () => void;
  pendingAttachments: OrchestratorChatAttachment[];
  addPendingAttachment: (attachment: OrchestratorChatAttachment) => void;
  removePendingAttachment: (index: number) => void;
  clearPendingAttachments: () => void;
  voiceMode: boolean;
  setVoiceMode: (enabled: boolean) => void;
  conversationMode: boolean;
  enterConversationMode: () => void;
  exitConversationMode: () => void;
  resultsPanelOpen: boolean;
  selectedArtifactId: string | null;
  openResultsPanel: (artifactId?: string) => void;
  closeResultsPanel: () => void;
  setSelectedArtifactId: (artifactId: string | null) => void;
  /** @deprecated Navigate to /dashboard instead */
  isOpen: boolean;
  /** @deprecated Navigate to /dashboard instead */
  open: (options?: { threadId?: string | null }) => void;
  /** @deprecated No overlay — no-op */
  close: () => void;
}

const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

const SESSION_MODE_KEY = "orchestrator_session_mode";

const VALID_MODES: OrchestratorSessionMode[] = [
  "auto",
  "planning",
  "writing",
  "research",
  "review",
  "casual",
  "strategy",
];

function loadSessionMode(siteId: string | null): OrchestratorSessionMode {
  if (typeof window === "undefined" || !siteId) return "auto";
  const stored = localStorage.getItem(`${SESSION_MODE_KEY}:${siteId}`);
  if (stored && VALID_MODES.includes(stored as OrchestratorSessionMode)) {
    return stored as OrchestratorSessionMode;
  }
  return "auto";
}

export function OrchestratorProvider({ children }: { children: React.ReactNode }) {
  const { currentSiteId } = useAuthStore();
  const [threadId, setThreadIdState] = useState<string | null>(null);
  const [liveArtifacts, setLiveArtifacts] = useState<OrchestratorArtifact[]>([]);
  const [sessionMode, setSessionModeState] = useState<OrchestratorSessionMode>("auto");
  const [effectiveSessionMode, setEffectiveSessionMode] = useState<OperationalSessionMode>("casual");
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [activeDraftBlogId, setActiveDraftBlogId] = useState<string | null>(null);
  const [selectionContext, setSelectionContext] = useState<OrchestratorSelectionContext | null>(null);
  const composerFocusRef = useRef<(() => void) | null>(null);
  const focusComposer = useCallback(() => {
    composerFocusRef.current?.();
  }, []);
  const [pendingAttachments, setPendingAttachments] = useState<OrchestratorChatAttachment[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactIdState] = useState<string | null>(null);

  const isWritingPinned = isWritingEffectiveMode(sessionMode, effectiveSessionMode);

  useEffect(() => {
    if (currentSiteId) {
      setSessionModeState(loadSessionMode(currentSiteId));
    }
  }, [currentSiteId]);

  useEffect(() => {
  // #region agent log
  fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "4b087c" },
    body: JSON.stringify({
      sessionId: "4b087c",
      runId: "dashboard-toggle",
      hypothesisId: "H3-context-clear",
      location: "orchestrator-provider.tsx:threadId-effect",
      message: "threadId changed — clearing selectionContext",
      data: {
        threadId,
        isWritingPinned,
        clearsSelection: true,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
    if (!isWritingPinned) {
      setResultsPanelOpen(false);
    }
    setSelectedArtifactIdState(null);
    setConversationMode(false);
    setVoiceMode(false);
    setDraftGenerating(false);
    setSelectionContext(null);
  }, [threadId, isWritingPinned]);

  useEffect(() => {
    if (isWritingPinned) {
      setResultsPanelOpen(true);
    }
  }, [isWritingPinned]);

  const enterConversationMode = useCallback(() => {
    setConversationMode(true);
    setVoiceMode(true);
  }, []);

  const exitConversationMode = useCallback(() => {
    setConversationMode(false);
    setVoiceMode(false);
  }, []);

  const setThreadId = useCallback((id: string | null) => {
    setThreadIdState(id);
  }, []);

  const setSessionMode = useCallback(
    (mode: OrchestratorSessionMode) => {
      setSessionModeState(mode);
      if (currentSiteId && typeof window !== "undefined") {
        localStorage.setItem(`${SESSION_MODE_KEY}:${currentSiteId}`, mode);
      }
      if (mode !== "auto" && mode !== "writing") {
        // manual operational lock
        setEffectiveSessionMode(mode);
      }
    },
    [currentSiteId]
  );

  const addLiveArtifacts = useCallback((artifacts: OrchestratorArtifact[]) => {
    if (artifacts.length === 0) return;
    setLiveArtifacts((prev) => [...prev, ...artifacts]);
  }, []);

  const mergeLiveArtifacts = useCallback((artifacts: OrchestratorArtifact[]) => {
    if (artifacts.length === 0) return;
    setLiveArtifacts((prev) => {
      const next = [...prev];
      for (const artifact of artifacts) {
        const blogId =
          typeof artifact.outputData.blog_id === "string"
            ? artifact.outputData.blog_id
            : typeof artifact.outputData.id === "string"
              ? artifact.outputData.id
              : null;
        const idx = blogId
          ? next.findIndex((a) => {
              const id =
                typeof a.outputData.blog_id === "string"
                  ? a.outputData.blog_id
                  : typeof a.outputData.id === "string"
                    ? a.outputData.id
                    : null;
              return id === blogId;
            })
          : -1;
        if (idx >= 0) {
          next[idx] = { ...next[idx], ...artifact, id: next[idx].id };
        } else {
          next.push(artifact);
        }
      }
      return next;
    });
  }, []);

  const clearLiveArtifacts = useCallback(() => setLiveArtifacts([]), []);

  const addPendingAttachment = useCallback((attachment: OrchestratorChatAttachment) => {
    setPendingAttachments((prev) => [...prev, attachment].slice(0, 10));
  }, []);

  const removePendingAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearPendingAttachments = useCallback(() => setPendingAttachments([]), []);

  const openResultsPanel = useCallback((artifactId?: string) => {
    setResultsPanelOpen(true);
    if (artifactId) {
      setSelectedArtifactIdState(artifactId);
    }
  }, []);

  const closeResultsPanel = useCallback(() => {
    if (isWritingPinned) return;
    setResultsPanelOpen(false);
  }, [isWritingPinned]);

  const setSelectedArtifactId = useCallback((artifactId: string | null) => {
    setSelectedArtifactIdState(artifactId);
  }, []);

  const open = useCallback(
    (options?: { threadId?: string | null }) => {
      if (options && Object.prototype.hasOwnProperty.call(options, "threadId")) {
        setThreadId(options.threadId ?? null);
      }
    },
    [setThreadId]
  );

  const value = useMemo<OrchestratorContextValue>(
    () => ({
      threadId,
      setThreadId,
      liveArtifacts,
      addLiveArtifacts,
      mergeLiveArtifacts,
      clearLiveArtifacts,
      sessionMode,
      setSessionMode,
      effectiveSessionMode,
      setEffectiveSessionMode,
      isWritingPinned,
      draftGenerating,
      setDraftGenerating,
      activeDraftBlogId,
      setActiveDraftBlogId,
      selectionContext,
      setSelectionContext,
      composerFocusRef,
      focusComposer,
      pendingAttachments,
      addPendingAttachment,
      removePendingAttachment,
      clearPendingAttachments,
      voiceMode,
      setVoiceMode,
      conversationMode,
      enterConversationMode,
      exitConversationMode,
      resultsPanelOpen,
      selectedArtifactId,
      openResultsPanel,
      closeResultsPanel,
      setSelectedArtifactId,
      isOpen: false,
      open,
      close: () => undefined,
    }),
    [
      threadId,
      setThreadId,
      liveArtifacts,
      addLiveArtifacts,
      mergeLiveArtifacts,
      clearLiveArtifacts,
      sessionMode,
      setSessionMode,
      effectiveSessionMode,
      isWritingPinned,
      draftGenerating,
      activeDraftBlogId,
      selectionContext,
      focusComposer,
      pendingAttachments,
      addPendingAttachment,
      removePendingAttachment,
      clearPendingAttachments,
      voiceMode,
      conversationMode,
      enterConversationMode,
      exitConversationMode,
      resultsPanelOpen,
      selectedArtifactId,
      openResultsPanel,
      closeResultsPanel,
      setSelectedArtifactId,
      open,
    ]
  );

  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

export function useOrchestrator(): OrchestratorContextValue {
  const ctx = useContext(OrchestratorContext);
  if (!ctx) {
    throw new Error("useOrchestrator must be used inside an OrchestratorProvider");
  }
  return ctx;
}

/** @deprecated Use useOrchestrator */
export function useAIPanel(): OrchestratorContextValue {
  return useOrchestrator();
}
