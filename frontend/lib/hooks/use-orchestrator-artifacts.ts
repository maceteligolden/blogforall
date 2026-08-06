"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/auth.store";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { extractArtifactsFromMessages, VIEWABLE_ARTIFACT_TOOLS } from "@/lib/utils/orchestrator-artifacts";

export function useOrchestratorArtifacts() {
  const { threadId, liveArtifacts, resultsPanelOpen, sessionMode, effectiveSessionMode, isWritingPinned } =
    useOrchestrator();
  const { currentSiteId } = useAuthStore();

  const threadQuery = useQuery({
    queryKey:
      currentSiteId && threadId
        ? QUERY_KEYS.ORCHESTRATOR_THREAD(currentSiteId, threadId)
        : ["orchestrator", "thread", "none"],
    queryFn: () => OrchestratorService.getThread(currentSiteId as string, threadId as string),
    enabled: !!currentSiteId && !!threadId,
    refetchOnWindowFocus: false,
  });

  const artifacts = useMemo(() => {
    const fromMessages = extractArtifactsFromMessages(threadQuery.data?.messages ?? []);
    const persistedKeys = new Set(fromMessages.map((a) => `${a.tool}-${a.summary}`));
    const merged = [...fromMessages];
    for (const live of liveArtifacts) {
      const key = `${live.tool}-${live.summary ?? ""}`;
      if (!persistedKeys.has(key)) {
        merged.push(live);
      }
    }
    return merged;
  }, [threadQuery.data?.messages, liveArtifacts]);

  const hasArtifacts = artifacts.length > 0;
  const hasViewableArtifacts = artifacts.some((a) => VIEWABLE_ARTIFACT_TOOLS.has(a.tool));
  // Only show when the panel was opened for viewable content (not chat/strategy skills).
  const showResultsPanel = hasViewableArtifacts && resultsPanelOpen;

  return {
    artifacts,
    hasArtifacts,
    hasViewableArtifacts,
    showResultsPanel,
    isWritingPinned,
    sessionMode,
    effectiveSessionMode,
    threadQuery,
  };
}
