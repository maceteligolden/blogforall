"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";

export function useDeleteThread(siteId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => {
      if (!siteId) throw new Error("No workspace selected");
      return OrchestratorService.deleteThread(siteId, threadId);
    },
    onSuccess: (_void, threadId) => {
      if (!siteId) return;
      queryClient.removeQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_THREAD(siteId, threadId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_THREADS(siteId) });
    },
  });
}
