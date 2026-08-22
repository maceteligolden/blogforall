"use client";

import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import { formatThreadTimestamp } from "@/lib/utils/format-thread-timestamp";
import type { OrchestratorThread } from "@/lib/api/types/orchestrator.types";

export function ConversationStartScreen({
  threads,
  onChat,
  onCall,
  onSelectThread,
  starting,
}: {
  threads: OrchestratorThread[];
  onChat: () => void;
  onCall: () => void;
  onSelectThread: (id: string) => void;
  starting?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-12 px-4">
      <h2 className="text-2xl font-semibold text-white text-center">How do you want to start?</h2>
      <p className="text-sm text-gray-400 mt-2 max-w-md text-center">
        Choose a campaign, optionally a topic, then chat with the AI strategist or get on a call. We&apos;ll open a
        workspace thread you can share with your team.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button
          type="button"
          onClick={onChat}
          disabled={starting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          <MessageSquare className="w-4 h-4" aria-hidden="true" />
          Chat with AI
        </button>
        <button
          type="button"
          onClick={onCall}
          disabled={starting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-200 hover:border-primary/50 hover:text-white disabled:opacity-50"
        >
          <Phone className="w-4 h-4" aria-hidden="true" />
          Get on a call
        </button>
      </div>

      <div className="w-full max-w-lg mt-12">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recent threads</p>
          <Link href="/dashboard/threads" className="text-xs text-primary hover:underline">
            View more
          </Link>
        </div>
        {threads.length === 0 ? (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        ) : (
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread._id}>
                <button
                  type="button"
                  onClick={() => onSelectThread(thread._id)}
                  className="w-full text-left rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 hover:border-primary/40"
                >
                  <p className="text-sm text-white truncate">{thread.title || "New conversation"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatThreadTimestamp(thread.last_activity_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
