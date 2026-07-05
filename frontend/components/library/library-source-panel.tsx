"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cloud, HardDrive, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/lib/store/auth.store";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";

interface LibrarySourcePanelProps {
  enabled?: boolean;
}

export function LibrarySourcePanel({ enabled = true }: LibrarySourcePanelProps) {
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.ORCHESTRATOR_KNOWLEDGE(currentSiteId) : ["orchestrator", "knowledge", "none"],
    queryFn: () => OrchestratorService.listKnowledgeSources(currentSiteId as string),
    enabled: enabled && !!currentSiteId,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => OrchestratorService.uploadKnowledgeSource(currentSiteId as string, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_KNOWLEDGE(currentSiteId as string),
      });
      setError(null);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Upload failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => OrchestratorService.deleteKnowledgeSource(currentSiteId as string, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_KNOWLEDGE(currentSiteId as string),
      });
    },
  });

  const connectGoogleMutation = useMutation({
    mutationFn: () => OrchestratorService.getGoogleDriveAuthUrl(currentSiteId as string),
    onSuccess: (url) => {
      if (url) window.location.href = url;
      else setError("Google Drive is not configured on this server.");
    },
    onError: () => setError("Google Drive connection is not available."),
  });

  if (!currentSiteId) {
    return <p className="text-sm text-gray-400">Select a workspace to manage your library.</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => connectGoogleMutation.mutate()}
          disabled={connectGoogleMutation.isPending}
          className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-800 hover:border-primary/40 hover:bg-gray-800/50 transition-colors text-center"
        >
          <HardDrive className="w-5 h-5 text-primary" />
          <span className="text-xs font-medium text-white">Google Drive</span>
        </button>
        <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-800 opacity-50 text-center">
          <Cloud className="w-5 h-5 text-gray-500" />
          <span className="text-xs text-gray-500">Dropbox — coming soon</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-3 rounded-lg border border-gray-800 opacity-50 text-center">
          <Cloud className="w-5 h-5 text-gray-500" />
          <span className="text-xs text-gray-500">OneDrive — coming soon</span>
        </div>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-gray-700 text-gray-300"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-1" />
          )}
          Upload files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (!files?.length) return;
            for (const file of Array.from(files)) {
              uploadMutation.mutate(file);
            }
            e.target.value = "";
          }}
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Connected sources</p>
        {sourcesQuery.isLoading && <p className="text-xs text-gray-500">Loading…</p>}
        {sourcesQuery.data?.length === 0 && !sourcesQuery.isLoading && (
          <p className="text-xs text-gray-500">No sources yet. Upload files or connect Google Drive.</p>
        )}
        <ul className="space-y-1.5">
          {sourcesQuery.data?.map((source) => (
            <li
              key={source._id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-gray-800/50 border border-gray-800"
            >
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{source.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {source.provider.replace("_", " ")}
                  {source.file_refs?.length ? ` · ${source.file_refs.length} file(s)` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(source._id)}
                className={cn(
                  "text-xs text-red-400 hover:text-red-300 shrink-0",
                  deleteMutation.isPending && "opacity-50"
                )}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
