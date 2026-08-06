"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";

export function useRenameThread(siteId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) => {
      if (!siteId) throw new Error("No workspace selected");
      return OrchestratorService.renameThread(siteId, threadId, title);
    },
    onSuccess: (updated) => {
      if (!siteId) return;
      queryClient.setQueryData(
        QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, updated._id),
        (old: { thread: { title: string }; messages: unknown[] } | undefined) =>
          old ? { ...old, thread: { ...old.thread, title: updated.title } } : old
      );
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId),
      });
    },
  });
}
