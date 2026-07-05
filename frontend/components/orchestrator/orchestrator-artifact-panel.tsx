"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileText, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useOrchestratorArtifacts } from "@/lib/hooks/use-orchestrator-artifacts";
import {
  extractUrlFromText,
  type OrchestratorArtifact,
} from "@/lib/utils/orchestrator-artifacts";
import type { BlogReviewResult } from "@/lib/api/services/blog-review.service";
import { Card } from "@/components/ui/card";
import { BlogDraftResultEditor } from "@/components/orchestrator/blog-draft-result-editor";

interface OrchestratorArtifactPanelProps {
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function artifactLabel(tool: string): string {
  switch (tool) {
    case "blogs.generateDraft":
      return "Blog generation";
    case "blogs.createDraft":
      return "Draft created";
    case "blogs.review":
      return "Content review";
    default:
      return tool.replace(/\./g, " · ");
  }
}

function BlogReviewArtifact({ artifact }: { artifact: OrchestratorArtifact }) {
  const data = artifact.outputData;
  const title = typeof data.title === "string" ? data.title : "Blog review";
  const score = typeof data.overall_score === "number" ? data.overall_score : undefined;
  const summary = typeof data.summary === "string" ? data.summary : undefined;
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  const scoreColor =
    score === undefined
      ? "text-gray-400"
      : score >= 8
        ? "text-green-400"
        : score >= 6
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <Card className="bg-gray-900 border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        {score !== undefined && (
          <span className={cn("text-lg font-bold shrink-0", scoreColor)}>{score}/10</span>
        )}
      </div>
      {summary && <p className="text-xs text-gray-400">{summary}</p>}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Suggestions ({suggestions.length})
          </p>
          {(suggestions as BlogReviewResult["suggestions"]).map((s, i) => (
            <div key={s.id ?? i} className="text-xs border-l-2 border-gray-700 pl-2">
              <span className="text-gray-300">{s.suggestion}</span>
              {s.explanation && <p className="text-gray-500 mt-0.5">{s.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GenericArtifact({ artifact }: { artifact: OrchestratorArtifact }) {
  const url = extractUrlFromText(artifact.summary ?? "");
  return (
    <Card className="bg-gray-900 border-gray-800 p-4 space-y-2">
      <p className="text-sm font-medium text-white">{artifactLabel(artifact.tool)}</p>
      {artifact.summary && (
        <p className="text-xs text-gray-400 whitespace-pre-wrap">{artifact.summary}</p>
      )}
      {url && (
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Open link
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}

function ArtifactContent({ artifact }: { artifact: OrchestratorArtifact }) {
  switch (artifact.tool) {
    case "blogs.generateDraft":
    case "blogs.createDraft":
      return <BlogDraftResultEditor artifact={artifact} className="h-full min-h-0" />;
    case "blogs.review":
      return <BlogReviewArtifact artifact={artifact} />;
    default:
      return <GenericArtifact artifact={artifact} />;
  }
}

export function OrchestratorArtifactPanel({
  className,
  mobileOpen = false,
  onMobileClose,
}: OrchestratorArtifactPanelProps) {
  const { threadId, selectedArtifactId, setSelectedArtifactId, closeResultsPanel } =
    useOrchestrator();
  const { artifacts } = useOrchestratorArtifacts();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (artifacts.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedArtifactId) {
      const idx = artifacts.findIndex((a) => a.id === selectedArtifactId);
      if (idx >= 0) {
        setSelectedIndex(idx);
        return;
      }
    }
    setSelectedIndex((prev) => {
      if (prev === null || prev >= artifacts.length) return artifacts.length - 1;
      return prev;
    });
  }, [artifacts, threadId, selectedArtifactId]);

  useEffect(() => {
    if (selectedIndex !== null && artifacts[selectedIndex]) {
      setSelectedArtifactId(artifacts[selectedIndex].id);
    }
  }, [selectedIndex, artifacts, setSelectedArtifactId]);

  const activeArtifact =
    selectedIndex !== null && artifacts[selectedIndex] ? artifacts[selectedIndex] : null;

  const isBlogDraft =
    activeArtifact?.tool === "blogs.generateDraft" || activeArtifact?.tool === "blogs.createDraft";

  const handleClose = () => {
    closeResultsPanel();
    onMobileClose?.();
  };

  return (
    <>
      {mobileOpen && artifacts.length > 0 && (
        <button
          type="button"
          aria-label="Close results panel"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={handleClose}
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-black border-gray-800 overflow-hidden",
          "fixed lg:relative inset-y-0 right-0 z-40 lg:z-auto",
          "top-16 lg:top-0 h-[calc(100vh-4rem)] lg:h-full w-full sm:max-w-md lg:max-w-none lg:w-full",
          "transform transition-transform duration-200 ease-out lg:transform-none",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          !mobileOpen && "hidden lg:flex",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0 bg-gray-950">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold truncate">
              {isBlogDraft ? "Blog draft" : "Results"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {artifacts.length > 1 && (
              <div className="hidden sm:flex flex-wrap gap-1 max-w-[12rem] justify-end">
                {artifacts.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedIndex(i)}
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border transition-colors truncate max-w-full",
                      selectedIndex === i
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900"
                    )}
                  >
                    {artifactLabel(a.tool)} {i + 1}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800"
              aria-label="Close results panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeArtifact ? (
            isBlogDraft ? (
              <ArtifactContent artifact={activeArtifact} />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 [scrollbar-gutter:stable]">
                <ArtifactContent artifact={activeArtifact} />
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {artifacts.length === 0 ? "Loading results…" : "Select a result to view."}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
