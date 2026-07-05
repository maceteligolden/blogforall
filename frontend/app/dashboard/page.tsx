"use client";

import { useState } from "react";
import { OrchestratorChat } from "@/components/orchestrator/orchestrator-chat";
import { OrchestratorArtifactPanel } from "@/components/orchestrator/orchestrator-artifact-panel";
import { WorkspaceSplitLayout } from "@/components/orchestrator/workspace-split-layout";
import { useOrchestratorArtifacts } from "@/lib/hooks/use-orchestrator-artifacts";

export default function DashboardPage() {
  const [mobileArtifactsOpen, setMobileArtifactsOpen] = useState(false);
  const { showResultsPanel } = useOrchestratorArtifacts();

  return (
    <div className="h-[calc(100vh-4rem)] min-h-0 overflow-hidden">
      <WorkspaceSplitLayout
        showRight={showResultsPanel}
        left={
          <OrchestratorChat
            className="h-full"
            mobileArtifactsOpen={mobileArtifactsOpen}
            onShowMobileArtifacts={() => setMobileArtifactsOpen(true)}
            onToggleMobileArtifacts={() => setMobileArtifactsOpen((v) => !v)}
          />
        }
        right={
          <OrchestratorArtifactPanel
            mobileOpen={mobileArtifactsOpen}
            onMobileClose={() => setMobileArtifactsOpen(false)}
          />
        }
      />
    </div>
  );
}
