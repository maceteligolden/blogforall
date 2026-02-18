"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CampaignAgentService, type AgentChatResponse, type AgentProposal } from "@/lib/api/services/campaign-agent.service";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Send, Calendar, Target, List } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export default function CampaignAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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

  const handleCreateCampaign = async () => {
    if (!proposal || creating) return;
    setCreating(true);
    try {
      const res = await CampaignAgentService.createFromProposal({
        session_id: sessionId ?? undefined,
        proposal,
      });
      const data = (res as { data?: { campaign?: { _id?: string }; scheduled_posts?: unknown[] } }).data;
      const campaignId = data?.campaign && typeof data.campaign === "object" && "_id" in data.campaign
        ? String((data.campaign as { _id: string })._id)
        : null;
      const count = Array.isArray(data?.scheduled_posts) ? data.scheduled_posts.length : 0;
      toast({
        title: "Campaign created",
        description: count > 0 ? `Campaign and ${count} scheduled posts created.` : "Campaign created.",
        variant: "success",
      });
      if (campaignId) {
        router.push(`/dashboard/campaigns/${campaignId}`);
      } else {
        router.push("/dashboard/scheduled-posts");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      toast({ title: "Error", description: message, variant: "error" });
    } finally {
      setCreating(false);
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
              <div className="rounded-lg border border-gray-700 bg-gray-800/80 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="font-medium text-white">Campaign proposal</p>
                  <p className="text-xs text-gray-400 mt-0.5">Review and create to add this campaign and scheduled posts.</p>
                </div>
                <div className="px-4 py-3 space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <span><strong className="text-white">{proposal.campaign.name}</strong> — {proposal.campaign.goal}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary shrink-0" />
                    <span>{proposal.campaign.start_date} → {proposal.campaign.end_date}</span>
                  </div>
                  {proposal.campaign.target_audience && (
                    <p className="text-gray-400">Audience: {proposal.campaign.target_audience}</p>
                  )}
                  <div className="pt-2">
                    <p className="flex items-center gap-2 text-gray-400 mb-1">
                      <List className="w-4 h-4" />
                      Scheduled posts ({proposal.scheduled_posts.length})
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-400">
                      {proposal.scheduled_posts.slice(0, 5).map((p, i) => (
                        <li key={i}>{p.title} — {p.scheduled_at}</li>
                      ))}
                      {proposal.scheduled_posts.length > 5 && (
                        <li className="text-gray-500">+{proposal.scheduled_posts.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-gray-700">
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={creating}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    {creating ? "Creating…" : "Create campaign"}
                  </Button>
                </div>
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
