"use client";

import { useState, useRef, useEffect } from "react";
import { CampaignAgentService, type AgentChatResponse, type AgentProposal } from "@/lib/api/services/campaign-agent.service";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function CampaignAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setProposal(null);

    try {
      const res = await CampaignAgentService.chat({
        session_id: sessionId ?? undefined,
        message: text,
      });
      const data = (res as { data?: AgentChatResponse }).data;
      if (!data) throw new Error("No response data");

      if (data.session_id) setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.proposal) setProposal(data.proposal);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="max-w-3xl mx-auto w-full px-6 py-6 flex flex-col flex-1">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "Campaign Agent" },
          ]}
        />
        <h1 className="text-2xl font-display text-white mb-2">Campaign Agent</h1>
        <p className="text-gray-400 text-sm mb-4">
          Chat to plan your campaign. Describe your goal, audience, and schedule; the agent will propose a campaign and scheduled posts.
        </p>

        <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>Send a message to start planning your campaign.</p>
                <p className="text-sm mt-2">e.g. &quot;We&apos;re launching our API next month, 3 posts a week&quot;</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    m.role === "user"
                      ? "bg-primary text-white"
                      : "bg-gray-800 text-gray-100 border border-gray-700"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            )}
            {proposal && (
              <div className="rounded-lg border border-gray-700 bg-gray-800/80 px-4 py-2 text-sm text-gray-300">
                <p className="font-medium text-white">Proposal ready: {proposal.campaign.name}</p>
                <p className="mt-1">{proposal.scheduled_posts.length} scheduled posts. Use the button below to create the campaign.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800 flex gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your campaign..."
              className="min-h-[44px] max-h-32 resize-none bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
              rows={1}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 bg-primary hover:bg-primary/90 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
