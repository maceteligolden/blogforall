"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Paperclip, Phone, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useSpeechRecognition } from "@/lib/hooks/use-speech-recognition";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { BlogService } from "@/lib/api/services/blog.service";
import { useAuthStore } from "@/lib/store/auth.store";
import type { OrchestratorSelectionContext } from "@/lib/types/orchestrator-session.types";
import { ChatModeSelector } from "./chat-mode-selector";

function SelectionReferenceChip({ context, onClear }: { context: OrchestratorSelectionContext; onClear: () => void }) {
  const excerpt =
    context.referenceType === "highlight" && context.selectedText
      ? context.selectedText.length > 80
        ? `${context.selectedText.slice(0, 80)}…`
        : context.selectedText
      : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary">
      <span className="flex-1 truncate">
        {context.referenceType === "highlight" && excerpt ? (
          <>
            Discussion focus: <span className="font-medium">{context.blogTitle}</span>
            {" — "}
            &ldquo;{excerpt}&rdquo;
          </>
        ) : (
          <>
            Referencing draft: <span className="font-medium">{context.blogTitle}</span>
          </>
        )}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear reference"
        className="text-primary/80 hover:text-primary shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onOpenKnowledgeBase?: () => void;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask the workspace orchestrator...",
  autoFocus = false,
  className,
  onOpenKnowledgeBase,
}: ChatComposerProps) {
  const { currentSiteId } = useAuthStore();
  const {
    sessionMode,
    setSessionMode,
    effectiveSessionMode,
    selectionContext,
    setSelectionContext,
    composerFocusRef,
    pendingAttachments,
    addPendingAttachment,
    removePendingAttachment,
    enterConversationMode,
    conversationMode,
  } = useOrchestrator();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    composerFocusRef.current = () => textareaRef.current?.focus();
    return () => {
      composerFocusRef.current = null;
    };
  }, [composerFocusRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seed = sessionStorage.getItem("bloggr_setup_seed");
    if (seed) {
      sessionStorage.removeItem("bloggr_setup_seed");
      onChange(seed);
      textareaRef.current?.focus();
    }
  }, [onChange]);

  const resolvedPlaceholder = selectionContext
    ? selectionContext.referenceType === "highlight"
      ? "Ask about this selection — explain, rephrase, or ask me to update the draft…"
      : "Ask about this draft or selection…"
    : placeholder;

  const {
    isSupported: sttSupported,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    onResult: (text, isFinal) => {
      if (text) onChange(value ? `${value} ${text}` : text);
      if (isFinal) setIsListening(false);
    },
    onError: () => setIsListening(false),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!disabled && value.trim().length > 0) {
        onSubmit();
      }
    }
  };

  const handleMicToggle = () => {
    if (!sttSupported) return;
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !currentSiteId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.type.startsWith("image/")) {
          const res = await BlogService.uploadImage(file);
          const url = res.data?.data?.url ?? res.data?.url;
          if (url) {
            addPendingAttachment({
              name: file.name,
              url,
              mime_type: file.type,
            });
          }
        } else {
          const uploaded = await OrchestratorService.uploadContextFile(currentSiteId, file);
          addPendingAttachment(uploaded);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {selectionContext && (
        <SelectionReferenceChip context={selectionContext} onClear={() => setSelectionContext(null)} />
      )}

      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {pendingAttachments.map((a, i) => (
            <span
              key={`${a.url}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-gray-800 border border-gray-700 text-gray-300"
            >
              {a.name}
              <button
                type="button"
                onClick={() => removePendingAttachment(i)}
                aria-label={`Remove ${a.name}`}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        className="rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 focus-within:border-primary/60 transition-colors"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && value.trim().length > 0) onSubmit();
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          rows={1}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full resize-none bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none disabled:opacity-50 max-h-60 py-1.5 min-h-[2.25rem]"
        />

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-800/80 mt-1">
          <div className="flex items-center gap-0.5">
            <ChatModeSelector
              value={sessionMode}
              effectiveMode={effectiveSessionMode}
              onChange={setSessionMode}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              aria-label="Attach file"
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileSelect}
            />
            {sttSupported && (
              <button
                type="button"
                onClick={handleMicToggle}
                disabled={disabled}
                aria-label={isListening ? "Stop listening" : "Start speech input"}
                className={cn(
                  "p-1.5 rounded-md disabled:opacity-40",
                  isListening ? "text-red-400 bg-red-900/30" : "text-gray-400 hover:text-white hover:bg-gray-800"
                )}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            {onOpenKnowledgeBase && (
              <button
                type="button"
                onClick={onOpenKnowledgeBase}
                className="hidden sm:inline px-1.5 py-1 text-[11px] text-gray-500 hover:text-primary transition-colors rounded-md hover:bg-gray-800"
              >
                Knowledge
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={enterConversationMode}
              disabled={disabled || conversationMode}
              aria-label="Start voice conversation"
              title="Start voice conversation"
              className={cn(
                "p-1.5 rounded-md text-gray-400 hover:text-primary hover:bg-primary/10 disabled:opacity-40",
                conversationMode && "text-primary bg-primary/10"
              )}
            >
              <Phone className="w-4 h-4" />
            </button>
            <Button
              type="submit"
              size="sm"
              disabled={disabled || value.trim().length === 0}
              className="bg-primary hover:bg-primary/90 text-white shrink-0 h-8 w-8 p-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>

      {onOpenKnowledgeBase && (
        <button
          type="button"
          onClick={onOpenKnowledgeBase}
          className="sm:hidden text-xs text-gray-500 hover:text-primary transition-colors"
        >
          Connect knowledge base
        </button>
      )}
    </div>
  );
}
