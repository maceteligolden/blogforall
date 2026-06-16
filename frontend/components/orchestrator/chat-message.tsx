"use client";

import ReactMarkdown from "react-markdown";
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
 * Wrap bare http(s) URLs in markdown link syntax so react-markdown renders
 * them as clickable anchors. Skips URLs that are already inside a markdown
 * link (`[text](url)`) by detecting the preceding `](` substring.
 */
function autoLinkBareUrls(input: string): string {
  if (!input) return input;
  const urlRe = /(https?:\/\/[^\s)\]]+)/g;
  return input.replace(urlRe, (match, _url, offset) => {
    // Look back two chars; if we're inside `](`, the URL is already a link.
    const prev = typeof offset === "number" ? input.slice(Math.max(0, offset - 2), offset) : "";
    if (prev === "](") return match;
    return `[${match}](${match})`;
  });
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
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-sm whitespace-pre-wrap"
            : "bg-gray-900 text-gray-100 border border-gray-800 rounded-tl-sm"
        )}
      >
        {isUser ? (
          content
        ) : (
          // Assistant replies can include markdown links (e.g. preview URLs)
          // and short paragraphs. Render them with react-markdown so URLs are
          // clickable and bullets render. Auto-link bare URLs too.
          <ReactMarkdown
            urlTransform={(value) => value}
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-primary hover:text-primary/80 break-all"
                >
                  {children}
                </a>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              code: ({ children }) => (
                <code className="px-1 py-0.5 rounded bg-gray-800 text-xs">{children}</code>
              ),
            }}
          >
            {autoLinkBareUrls(content)}
          </ReactMarkdown>
        )}
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
