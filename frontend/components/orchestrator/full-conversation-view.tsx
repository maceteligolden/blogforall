"use client";

import { Mic, MicOff, PhoneOff, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ChatModeSelector } from "./chat-mode-selector";
import type { OrchestratorSessionMode } from "@/lib/types/orchestrator-session.types";

export type ConversationStatus = "idle" | "listening" | "thinking" | "speaking";

interface FullConversationViewProps {
  threadTitle: string;
  sessionMode: OrchestratorSessionMode;
  onSessionModeChange: (mode: OrchestratorSessionMode) => void;
  status: ConversationStatus;
  interimTranscript: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
  isListening: boolean;
  sttSupported: boolean;
  disabled?: boolean;
  error?: string | null;
  onMicToggle: () => void;
  onEndCall: () => void;
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  idle: "Tap the microphone to speak",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

export function FullConversationView({
  threadTitle,
  sessionMode,
  onSessionModeChange,
  status,
  interimTranscript,
  lastUserMessage,
  lastAssistantMessage,
  isListening,
  sttSupported,
  disabled = false,
  error,
  onMicToggle,
  onEndCall,
}: FullConversationViewProps) {
  const activeOrb = status === "listening" || status === "speaking" || isListening;

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-hidden bg-gradient-to-b from-gray-950 via-black to-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 35%, hsl(var(--primary) / 0.25), transparent 70%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-4 md:px-6 py-4 shrink-0 border-b border-white/5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-primary/80 font-medium">
            Voice conversation
          </p>
          <p className="text-sm font-semibold text-white truncate mt-0.5">{threadTitle}</p>
        </div>
        <ChatModeSelector
          value={sessionMode}
          onChange={onSessionModeChange}
          disabled={disabled}
        />
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
              className={cn(
                "w-10 h-10 transition-colors",
                activeOrb ? "text-primary" : "text-gray-500"
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        <p className="text-sm font-medium text-gray-300" role="status" aria-live="polite">
          {STATUS_LABEL[status]}
        </p>

        <div className="w-full max-w-md space-y-3 min-h-[8rem]">
          {(interimTranscript || lastUserMessage) && (
            <div className="rounded-2xl rounded-tr-sm bg-primary/90 text-white px-4 py-3 text-sm ml-auto max-w-[90%]">
              <p className="text-[10px] uppercase tracking-wide text-primary-foreground/70 mb-1">
                You
              </p>
              <p className="whitespace-pre-wrap">{interimTranscript || lastUserMessage}</p>
            </div>
          )}
          {lastAssistantMessage && status !== "thinking" && (
            <div className="rounded-2xl rounded-tl-sm bg-gray-900/90 border border-gray-800 text-gray-100 px-4 py-3 text-sm mr-auto max-w-[90%]">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Assistant</p>
              <p className="whitespace-pre-wrap line-clamp-6">{lastAssistantMessage}</p>
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
      </div>

      <footer className="relative z-10 shrink-0 px-6 pb-8 pt-4 border-t border-white/5">
        {error && (
          <p className="text-center text-xs text-red-400 mb-4" role="alert">
            {error}
          </p>
        )}
        {!sttSupported && (
          <p className="text-center text-xs text-amber-500/90 mb-4">
            Speech recognition is not supported in this browser. End the call to use text chat.
          </p>
        )}
        <div className="flex items-center justify-center gap-8">
          {sttSupported && (
            <button
              type="button"
              onClick={onMicToggle}
              disabled={disabled || status === "thinking" || status === "speaking"}
              aria-label={isListening ? "Stop listening" : "Start listening"}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                "border-2 disabled:opacity-40 disabled:pointer-events-none",
                isListening
                  ? "border-red-500/60 bg-red-950/50 text-red-400"
                  : "border-gray-600 bg-gray-900 text-gray-200 hover:border-primary/50 hover:text-white"
              )}
            >
              {isListening ? (
                <MicOff className="w-7 h-7" aria-hidden="true" />
              ) : (
                <Mic className="w-7 h-7" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onEndCall}
            className="flex flex-col items-center gap-1.5 group"
            aria-label="End conversation"
          >
            <span className="w-16 h-16 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 transition-colors">
              <PhoneOff className="w-7 h-7" aria-hidden="true" />
            </span>
            <span className="text-xs text-gray-400 group-hover:text-gray-200">End conversation</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
