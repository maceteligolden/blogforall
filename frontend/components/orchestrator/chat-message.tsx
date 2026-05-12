"use client";

import { cn } from "@/lib/utils/cn";
import { Bot, User as UserIcon, Wrench } from "lucide-react";
import type { OrchestratorMessageRole } from "@/lib/api/types/orchestrator.types";

export interface ChatMessageProps {
  role: OrchestratorMessageRole;
  content: string;
  toolName?: string;
  className?: string;
}

/**
 * Single conversation bubble. Tool messages render compact as a status row so
 * they don't visually compete with assistant prose.
 */
export function ChatMessage({ role, content, toolName, className }: ChatMessageProps) {
  if (role === "tool") {
    return (
      <div className={cn("flex items-start gap-2 text-xs text-gray-400", className)}>
        <Wrench className="w-3.5 h-3.5 mt-0.5 text-primary" aria-hidden="true" />
        <span className="font-mono">
          {toolName ? `${toolName} · ` : ""}
          {content}
        </span>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "flex-row", className)}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
          isUser
            ? "bg-primary/20 border-primary/30 text-primary"
            : "bg-gray-800 border-gray-700 text-gray-300"
        )}
        aria-hidden="true"
      >
        {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm"
            : "bg-gray-900 text-gray-100 border border-gray-800 rounded-tl-sm"
        )}
      >
        {content}
      </div>
    </div>
  );
}

/**
 * Three-dot "the assistant is thinking" indicator. Used while the chat
 * endpoint is in-flight; we never stream tokens in v1.
 */
export function ThinkingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-start gap-3" role="status" aria-live="polite">
      <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 text-gray-300 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm text-gray-400">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
        </span>
      </div>
    </div>
  );
}
