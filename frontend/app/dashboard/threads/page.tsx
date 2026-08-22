"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageSquare, Pencil, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useRenameThread } from "@/lib/hooks/use-rename-thread";
import { useDeleteThread } from "@/lib/hooks/use-delete-thread";
import { formatThreadTimestamp } from "@/lib/utils/format-thread-timestamp";
import type { ThreadAssociationEntityType } from "@/lib/api/types/orchestrator.types";

const FILTERS: Array<{ label: string; value: ThreadAssociationEntityType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Strategy", value: "strategy" },
  { label: "Campaigns", value: "campaign" },
  { label: "Posts", value: "blog" },
];

export default function ThreadsPage() {
  const router = useRouter();
  const { currentSiteId } = useAuthStore();
  const { setThreadId, clearLiveArtifacts } = useOrchestrator();
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState<ThreadAssociationEntityType | "all">("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const rename = useRenameThread(currentSiteId);
  const remove = useDeleteThread(currentSiteId);

  const threadsQuery = useQuery({
    queryKey: currentSiteId
      ? [...QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId), "all", q, entityType, includeArchived]
      : ["orchestrator", "threads", "none"],
    queryFn: () =>
      OrchestratorService.listThreadsPage(currentSiteId as string, {
        limit: 100,
        q: q.trim() || undefined,
        entity_type: entityType === "all" ? undefined : entityType,
        include_archived: includeArchived || undefined,
      }),
    enabled: !!currentSiteId,
  });

  const threads = threadsQuery.data?.threads ?? [];
  const filtered = useMemo(() => threads, [threads]);

  const openThread = (id: string) => {
    clearLiveArtifacts();
    setThreadId(id);
    router.push(`/dashboard?thread=${encodeURIComponent(id)}`);
  };

  const submitRename = () => {
    if (!editingId) return;
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    rename.mutate(
      { threadId: editingId, title: trimmed },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditTitle("");
        },
      }
    );
  };

  const handleRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Threads</h1>
          <p className="text-sm text-gray-400">Workspace conversations with the AI strategist</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name"
            className="pl-9 bg-gray-900 border-gray-800"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Archived
        </label>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setEntityType(filter.value)}
            className={`text-xs px-3 py-1 rounded-full border ${
              entityType === filter.value
                ? "border-primary text-primary bg-primary/10"
                : "border-gray-700 text-gray-400 hover:text-white"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {threadsQuery.isLoading && <p className="text-sm text-gray-500">Loading threads…</p>}
      {threadsQuery.isError && <p className="text-sm text-red-400">Couldn&apos;t load threads.</p>}
      {!threadsQuery.isLoading && filtered.length === 0 && <p className="text-sm text-gray-500">No threads yet.</p>}

      <ul className="space-y-2">
        {filtered.map((thread) => (
          <li
            key={thread._id}
            className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 flex items-center gap-3"
          >
            <button type="button" onClick={() => openThread(thread._id)} className="flex-1 min-w-0 text-left">
              {editingId === thread._id ? (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={handleRenameKey}
                    className="flex-1 px-2 py-1 text-sm bg-gray-950 border border-gray-700 rounded text-white"
                  />
                  <button type="button" onClick={submitRename} aria-label="Save">
                    <Check className="w-4 h-4 text-primary" />
                  </button>
                  <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-white truncate">{thread.title || "New conversation"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {thread.channel === "call" ? "Call · " : ""}
                    {formatThreadTimestamp(thread.last_activity_at)}
                  </p>
                </>
              )}
            </button>
            {editingId !== thread._id && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 h-8"
                  onClick={() => openThread(thread._id)}
                >
                  Open
                </Button>
                <button
                  type="button"
                  aria-label="Rename"
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800"
                  onClick={() => {
                    setEditingId(thread._id);
                    setEditTitle(thread.title);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-gray-800"
                  onClick={() => {
                    if (confirm("Delete this thread?")) remove.mutate(thread._id);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
