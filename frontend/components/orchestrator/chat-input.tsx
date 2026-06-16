"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Auto-growing textarea + send button. Submits on Enter (Shift+Enter inserts a
 * newline) and is the single input control reused by both the onboarding wizard
 * and the global AI panel.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Ask the workspace orchestrator...",
  autoFocus = false,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!disabled && value.trim().length > 0) {
        onSubmit();
      }
    }
  };

  return (
    <form
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-gray-800 bg-gray-900 px-3 py-2 focus-within:border-primary/60 transition-colors",
        className
      )}
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled && value.trim().length > 0) {
          onSubmit();
        }
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        autoFocus={autoFocus}
        className="flex-1 resize-none bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none disabled:opacity-50 max-h-60"
      />
      <Button
        type="submit"
        size="sm"
        disabled={disabled || value.trim().length === 0}
        className="bg-primary hover:bg-primary/90 text-white shrink-0"
        aria-label="Send message"
      >
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}
