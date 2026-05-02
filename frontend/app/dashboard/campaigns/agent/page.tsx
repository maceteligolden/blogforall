"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { CampaignAgentService, type AgentChatResponse, type AgentProposal } from "@/lib/api/services/campaign-agent.service";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { Send, Calendar, Target, List, FileText, FolderPlus, LayoutList, HelpCircle } from "lucide-react";

const QUICK_ACTIONS: { label: string; message: string; icon: React.ReactNode }[] = [
  { label: "Create a blog draft", message: "Create a blog draft", icon: <FileText className="w-4 h-4" /> },
  { label: "Plan a campaign", message: "Plan a campaign", icon: <Calendar className="w-4 h-4" /> },
  { label: "Add a category", message: "Add a category", icon: <FolderPlus className="w-4 h-4" /> },
  { label: "Show my drafts", message: "Show my drafts", icon: <List className="w-4 h-4" /> },
  { label: "What can you do?", message: "What can you do?", icon: <HelpCircle className="w-4 h-4" /> },
];

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Strip unfenced JSON object that looks like { "campaign": ..., "scheduled_posts": ... } so it never shows in the chat. */
function stripUnfencedProposalJson(content: string): string {
  const startMatch = content.match(/\{\s*"campaign"\s*:/);
  if (!startMatch || startMatch.index === undefined) return content;
  const start = startMatch.index;
  let depth = 0;
  for (let i = start; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        const before = content.slice(0, start).trimEnd();
        const after = content.slice(i + 1).trimStart();
        return (before + (before && after ? "\n" : "") + after).trim();
      }
    }
  }
  return content.slice(0, start).trimEnd();
}

/** Remove only fenced blocks that contain JSON (start with {). Keep other code blocks (e.g. lists of details). */
function stripFencedJsonOnly(content: string): string {
  return content.replace(/\s*```(?:json)?\s*([\s\S]*?)```\s*/g, (match, inner) => {
    if (/^\s*\{/.test(inner)) return "";
    return match;
  }).replace(/\n{3,}/g, "\n\n").trim();
}

/** Show only the actual response: strip JSON (fenced or raw), <think> tags; keep other content and code blocks. */
function displayReply(content: string): string {
  let out = stripFencedJsonOnly(content);
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  out = stripUnfencedProposalJson(out);
  if (!out) {
    return "I've prepared a campaign proposal for you — review it below and click **Create campaign** when ready.";
  }
  return out;
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-white">{children}</strong>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="my-2 list-disc list-inside space-y-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="my-2 list-decimal list-inside space-y-0.5">{children}</ol>,
  li: ({ children }: { children?: React.ReactNode }) => <li className="ml-0">{children}</li>,
  h1: ({ children }: { children?: React.ReactNode }) => <h3 className="mt-2 mb-1 font-semibold text-white text-sm">{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h3 className="mt-2 mb-1 font-semibold text-white text-sm">{children}</h3>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3 className="mt-2 mb-1 font-medium text-white text-sm">{children}</h3>,
};

export default function CampaignAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useAuth();
  const firstName = profile?.first_name?.trim() || "there";
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

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setLoading(true);
    setProposal(null);

    try {
      const res = await CampaignAgentService.chat({
        session_id: sessionId ?? undefined,
        message: trimmed,
      });
      const payload = (res as { data?: { data?: AgentChatResponse } }).data?.data;
      if (!payload) throw new Error("No response data");

      if (payload.session_id) setSessionId(payload.session_id);
      setMessages((prev) => [...prev, { role: "assistant", content: payload.reply ?? "" }]);
      setProposal(payload.proposal ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [sessionId, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
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
        router.push("/dashboard/blogs/scheduled");
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
            { label: "Assistant" },
          ]}
        />
        <h1 className="text-2xl font-display text-white mb-2">Assistant</h1>
        <p className="text-gray-400 text-sm mb-4">
          I can help you draft posts, plan campaigns, add categories, or list your drafts. Tell me what you need or pick an option below.
        </p>

        <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-gray-800 bg-gray-900/50">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <>
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-4 py-3 bg-gray-800 text-gray-100 border border-gray-700">
                    <p className="text-sm font-medium text-white">Hi {firstName}, what would you like to do today?</p>
                    <p className="text-sm text-gray-400 mt-1">
                      I can help you draft posts, plan campaigns, add categories, or show your drafts. Pick one below or tell me in your own words.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map(({ label, message, icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => sendMessage(message)}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-800/80 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:border-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </>
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
                  {m.role === "assistant" ? (
                    <div className="text-sm prose prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 max-w-none">
                      <ReactMarkdown components={markdownComponents}>
                        {displayReply(m.content)}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                  )}
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
