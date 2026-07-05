"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { OrchestratorArtifact } from "@/lib/utils/orchestrator-artifacts";
import type {
  OrchestratorChatAttachment,
  OrchestratorSelectionContext,
  OrchestratorSessionMode,
} from "@/lib/types/orchestrator-session.types";
import { useAuthStore } from "@/lib/store/auth.store";

interface OrchestratorContextValue {
  threadId: string | null;
  setThreadId: (threadId: string | null) => void;
  liveArtifacts: OrchestratorArtifact[];
  addLiveArtifacts: (artifacts: OrchestratorArtifact[]) => void;
  clearLiveArtifacts: () => void;
  sessionMode: OrchestratorSessionMode;
  setSessionMode: (mode: OrchestratorSessionMode) => void;
  selectionContext: OrchestratorSelectionContext | null;
  setSelectionContext: (ctx: OrchestratorSelectionContext | null) => void;
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

function loadSessionMode(siteId: string | null): OrchestratorSessionMode {
  if (typeof window === "undefined" || !siteId) return "planning";
  const stored = localStorage.getItem(`${SESSION_MODE_KEY}:${siteId}`);
  if (
    stored === "planning" ||
    stored === "writing" ||
    stored === "research" ||
    stored === "review" ||
    stored === "casual"
  ) {
    return stored;
  }
  return "planning";
}

export function OrchestratorProvider({ children }: { children: React.ReactNode }) {
  const { currentSiteId } = useAuthStore();
  const [threadId, setThreadIdState] = useState<string | null>(null);
  const [liveArtifacts, setLiveArtifacts] = useState<OrchestratorArtifact[]>([]);
  const [sessionMode, setSessionModeState] = useState<OrchestratorSessionMode>("planning");
  const [selectionContext, setSelectionContext] = useState<OrchestratorSelectionContext | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<OrchestratorChatAttachment[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [selectedArtifactId, setSelectedArtifactIdState] = useState<string | null>(null);

  useEffect(() => {
    if (currentSiteId) {
      setSessionModeState(loadSessionMode(currentSiteId));
    }
  }, [currentSiteId]);

  useEffect(() => {
    setResultsPanelOpen(false);
    setSelectedArtifactIdState(null);
    setConversationMode(false);
    setVoiceMode(false);
  }, [threadId]);

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
    },
    [currentSiteId]
  );

  const addLiveArtifacts = useCallback((artifacts: OrchestratorArtifact[]) => {
    if (artifacts.length === 0) return;
    setLiveArtifacts((prev) => [...prev, ...artifacts]);
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
    setResultsPanelOpen(false);
  }, []);

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
      clearLiveArtifacts,
      sessionMode,
      setSessionMode,
      selectionContext,
      setSelectionContext,
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
      clearLiveArtifacts,
      sessionMode,
      setSessionMode,
      selectionContext,
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
