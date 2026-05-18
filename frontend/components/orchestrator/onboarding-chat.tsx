"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import type { ChatTurnResponse } from "@/lib/api/types/orchestrator.types";
import { QUERY_KEYS } from "@/lib/api/config";
import { useTokenUsage, useInvalidateTokenUsage } from "@/lib/hooks/use-token-usage";
import { useTokenExhaustion } from "@/components/usage/token-exhaustion-provider";
import { TokenUsageBadge } from "@/components/usage/token-usage-badge";
import { ChatInput } from "./chat-input";
import { ChatMessage, ThinkingIndicator } from "./chat-message";

interface UIMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
}

const WELCOME_MESSAGE: UIMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Welcome to your new workspace. I'm the workspace orchestrator. " +
    "To get you set up I'll ask a few quick questions about your business, " +
    "audience, voice, and how often you'd like to publish. " +
    "Whenever you're ready, tell me a little about what this workspace is for.",
};

export interface OnboardingChatProps {
  siteId: string;
  onCompleted: () => void;
}

/**
 * Constrained onboarding chat. The backend forces every turn through the
 * workspace's single onboarding thread and the supervisor is only allowed to
 * call workspace.completeOnboarding, so we don't render tool-call controls or
 * thread switching here. When the API reports onboarding_completed we hand
 * off to the parent which usually routes to the invite step or the dashboard.
 */
export function OnboardingChat({ siteId, onCompleted }: OnboardingChatProps) {
  const [messages, setMessages] = useState<UIMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data: tokenUsage } = useTokenUsage();
  const invalidateTokenUsage = useInvalidateTokenUsage();
  const { showFromError } = useTokenExhaustion();
  const tokensExhausted =
    tokenUsage && !tokenUsage.unlimited && tokenUsage.available <= 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setError(null);
    setInput("");
    const userMsg: UIMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    try {
      const res: ChatTurnResponse = await OrchestratorService.onboardingChat(siteId, text);
      const newMessages: UIMessage[] = [];
      for (const call of res.tool_calls ?? []) {
        newMessages.push({
          id: `tool-${call.tool}-${Date.now()}-${newMessages.length}`,
          role: "tool",
          content: call.summary,
          toolName: call.tool,
        });
      }
      newMessages.push({
        id: res.assistant_message.id,
        role: "assistant",
        content: res.assistant_message.content,
      });
      setMessages((prev) => [...prev, ...newMessages]);
      if (res.onboarding_completed) {
        // The workspace just flipped from "onboarding" to "active" on the backend.
        // Invalidate the cached sites list and onboarding-status query so the
        // DashboardLayout gate sees the fresh status the next time it mounts;
        // otherwise it will redirect the user back into this onboarding chat
        // with a brand-new thread.
        try {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES }),
            queryClient.invalidateQueries({ queryKey: ["onboarding", "status"] }),
          ]);
        } catch {
          // best-effort; the dashboard layout's own refetchOnMount will still
          // pick up the new status shortly after navigation.
        }
        // Give the user a beat to read the final assistant reply before we redirect.
        window.setTimeout(() => onCompleted(), 1200);
      }
      invalidateTokenUsage();
    } catch (e: unknown) {
      if (showFromError(e)) {
        invalidateTokenUsage();
        setError("Daily AI token limit reached.");
      } else {
        const apiMessage = (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(apiMessage ?? "Something went wrong. Please try again.");
      }
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Workspace setup</p>
            <p className="text-xs text-gray-400 leading-tight">
              Tell the orchestrator about your goals so it can tailor content for you.
            </p>
          </div>
        </div>
        <TokenUsageBadge compact />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((m) => (
          <ChatMessage key={m.id} role={m.role} content={m.content} toolName={m.toolName} />
        ))}
        {isSending && <ThinkingIndicator />}
        {error && (
          <div className="rounded-md bg-red-900/40 border border-red-800 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-800">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          disabled={isSending || !!tokensExhausted}
          autoFocus
          placeholder={
            tokensExhausted
              ? "Daily AI token limit reached"
              : "Tell me about your business, audience, and goals..."
          }
        />
        <p className="mt-2 text-xs text-gray-500">
          When the orchestrator has enough context it will finish setup and unlock your dashboard.
        </p>
      </div>
    </div>
  );
}
