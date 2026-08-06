"use client";

import { useEffect, useState } from "react";
import { Captions, CaptionsOff, Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ChatModeSelector } from "./chat-mode-selector";
import type { OperationalSessionMode, OrchestratorSessionMode } from "@/lib/types/orchestrator-session.types";

export type ConversationStatus = "idle" | "listening" | "thinking" | "speaking";

const TRANSCRIPT_STORAGE_KEY = "bloggr.voice.showTranscript";

interface FullConversationViewProps {
  threadTitle: string;
  sessionMode: OrchestratorSessionMode;
  effectiveSessionMode: OperationalSessionMode;
  onSessionModeChange: (mode: OrchestratorSessionMode) => void;
  status: ConversationStatus;
  interimTranscript: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  isListening: boolean;
  sttSupported: boolean;
  disabled?: boolean;
  error?: string | null;
  hasResults?: boolean;
  onViewResults?: () => void;
  /** Writing HITL checkpoints — spoken flow still needs Approve/Continue. */
  workflowActions?: Array<{ label: string; onClick: () => void }>;
  onMicToggle: () => void;
  onEndCall: () => void;
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  idle: "Tap Mute to start listening",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

function loadShowTranscript(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(TRANSCRIPT_STORAGE_KEY);
  if (stored === null) return true;
  return stored !== "false";
}

export function FullConversationView({
  threadTitle,
  sessionMode,
  effectiveSessionMode,
  onSessionModeChange,
  status,
  interimTranscript,
  lastUserMessage,
  lastAssistantMessage,
  isListening,
  sttSupported,
  disabled = false,
  error,
  hasResults = false,
  onViewResults,
  workflowActions,
  onMicToggle,
  onEndCall,
}: FullConversationViewProps) {
  const activeOrb = status === "listening" || status === "speaking" || isListening;
  const [showTranscript, setShowTranscript] = useState(true);

  useEffect(() => {
    setShowTranscript(loadShowTranscript());
  }, []);

  const toggleTranscript = () => {
    setShowTranscript((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(TRANSCRIPT_STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden bg-gradient-to-b from-gray-950 via-black to-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 35%, hsl(var(--primary) / 0.25), transparent 70%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-4 shrink-0 border-b border-white/5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-primary/80 font-medium">Voice conversation</p>
          <p className="text-sm font-semibold text-white truncate mt-0.5">{threadTitle}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Same capabilities as text — speak naturally.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasResults && onViewResults && (
            <button
              type="button"
              onClick={onViewResults}
              className="text-xs font-medium text-primary hover:text-primary/80 px-2.5 py-1.5 rounded-md border border-primary/30 bg-primary/10"
            >
              View results
            </button>
          )}
          <ChatModeSelector
            value={sessionMode}
            effectiveMode={effectiveSessionMode}
            onChange={onSessionModeChange}
            disabled={disabled}
          />
        </div>
      </header>

      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-8 gap-8">
        <div className="relative flex items-center justify-center">
          {activeOrb && (
            <>
              <span className="absolute w-40 h-40 rounded-full bg-primary/10 animate-ping" />
              <span className="absolute w-32 h-32 rounded-full bg-primary/15 animate-pulse" />
            </>
          )}
          <div
            className={cn(
              "relative w-28 h-28 rounded-full flex items-center justify-center border-2 transition-all duration-300",
              activeOrb
                ? "border-primary/60 bg-primary/20 shadow-[0_0_40px_hsl(var(--primary)/0.35)]"
                : "border-gray-700 bg-gray-900/80"
            )}
          >
            <Sparkles
              className={cn("w-10 h-10 transition-colors", activeOrb ? "text-primary" : "text-gray-500")}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="text-sm font-medium text-gray-300" role="status" aria-live="polite">
          {STATUS_LABEL[status]}
        </p>

        {showTranscript && (
          <div className="w-full max-w-md space-y-3 min-h-[8rem]">
            {(interimTranscript || lastUserMessage) && (
              <div className="rounded-2xl rounded-tr-sm bg-primary/90 text-white px-4 py-3 text-sm ml-auto max-w-[90%]">
                <p className="text-[10px] uppercase tracking-wide text-primary-foreground/70 mb-1">You</p>
                <p className="whitespace-pre-wrap">{interimTranscript || lastUserMessage}</p>
              </div>
            )}
            {lastAssistantMessage && status !== "thinking" && (
              <div className="rounded-2xl rounded-tl-sm bg-gray-900/90 border border-gray-800 text-gray-100 px-4 py-3 text-sm mr-auto max-w-[90%]">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Assistant</p>
                <p className="whitespace-pre-wrap line-clamp-6">{lastAssistantMessage}</p>
              </div>
            )}
            {workflowActions && workflowActions.length > 0 && status !== "thinking" && (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {workflowActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.onClick}
                    disabled={disabled}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {status === "thinking" && (
              <div className="flex justify-center gap-1.5 py-2" aria-hidden="true">
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="relative z-10 shrink-0 px-6 pb-8 pt-4 border-t border-white/5">
        {error && (
          <p className="text-center text-xs text-red-400 mb-4" role="alert">
            {error}
          </p>
        )}
        {!sttSupported && (
          <p className="text-center text-xs text-amber-500/90 mb-4">
            Speech recognition isn&apos;t available in this browser. You can still use the results panel; try Chrome for
            mic input.
          </p>
        )}
        {/* Unified call controls: Mute | Transcript | End */}
        <div className="flex items-end justify-center gap-6 sm:gap-10">
          {sttSupported && (
            <button
              type="button"
              onClick={onMicToggle}
              disabled={disabled || status === "thinking" || status === "speaking"}
              aria-label={isListening ? "Mute microphone" : "Unmute microphone"}
              className="flex flex-col items-center gap-1.5 group disabled:opacity-40"
            >
              <span
                className={cn(
                  "w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all",
                  isListening
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-gray-600 bg-gray-900 text-gray-300 group-hover:border-gray-400"
                )}
              >
                {isListening ? (
                  <Mic className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <MicOff className="w-6 h-6" aria-hidden="true" />
                )}
              </span>
              <span className="text-xs text-gray-400 group-hover:text-gray-200">
                {isListening ? "Mute" : "Unmute"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTranscript}
            aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
            aria-pressed={showTranscript}
            className="flex flex-col items-center gap-1.5 group"
          >
            <span
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all",
                showTranscript
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-gray-600 bg-gray-900 text-gray-300 group-hover:border-gray-400"
              )}
            >
              {showTranscript ? (
                <Captions className="w-6 h-6" aria-hidden="true" />
              ) : (
                <CaptionsOff className="w-6 h-6" aria-hidden="true" />
              )}
            </span>
            <span className="text-xs text-gray-400 group-hover:text-gray-200">Transcript</span>
          </button>

          <button
            type="button"
            onClick={onEndCall}
            className="flex flex-col items-center gap-1.5 group"
            aria-label="End call"
          >
            <span className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 transition-colors">
              <PhoneOff className="w-6 h-6" aria-hidden="true" />
            </span>
            <span className="text-xs text-gray-400 group-hover:text-gray-200">End call</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
