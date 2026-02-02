"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, X, CheckCircle2 } from "lucide-react";

export type GenerationStage = "analyzing" | "generating" | "reviewing" | "complete";

interface GenerationProgressProps {
  isOpen: boolean;
  onCancel: () => void;
  currentStage: GenerationStage;
  canCancel?: boolean;
}

const stages: { key: GenerationStage; label: string; description: string }[] = [
  {
    key: "analyzing",
    label: "Analyzing Prompt",
    description: "Extracting topic, domain, and audience information...",
  },
  {
    key: "generating",
    label: "Generating Content",
    description: "Creating your blog post with AI and reviewing quality...",
  },
  {
    key: "reviewing",
    label: "Reviewing Content",
    description: "Analyzing quality and providing suggestions...",
  },
  {
    key: "complete",
    label: "Complete",
    description: "Blog post generated successfully!",
  },
];

export function GenerationProgress({
  isOpen,
  onCancel,
  currentStage,
  canCancel = true,
}: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    const stageIndex = stages.findIndex((s) => s.key === currentStage);
    const baseProgress = (stageIndex / (stages.length - 1)) * 100;

    // Animate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= baseProgress) {
          clearInterval(interval);
          return baseProgress;
        }
        return Math.min(prev + 2, baseProgress);
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStage, isOpen]);

  const currentStageIndex = stages.findIndex((s) => s.key === currentStage);

  return (
    <Modal isOpen={isOpen} onClose={() => {}} size="md">
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Generating Blog Post</h2>
          {canCancel && currentStage !== "complete" && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">
                {stages[currentStageIndex]?.label || "Processing..."}
              </span>
              <span className="text-sm text-gray-400">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stages */}
          <div className="space-y-4">
            {stages.map((stage, index) => {
              const isActive = stage.key === currentStage;
              const isComplete = currentStageIndex > index;
              const isPending = currentStageIndex < index;

              return (
                <div
                  key={stage.key}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-purple-900/20 border border-purple-700"
                      : isComplete
                        ? "bg-green-900/10 border border-green-800"
                        : isPending
                          ? "bg-gray-800/50 border border-gray-700"
                          : "bg-gray-800/30 border border-gray-700"
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isComplete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isActive ? "text-purple-300" : isComplete ? "text-green-300" : "text-gray-400"
                      }`}
                    >
                      {stage.label}
                    </p>
                    {(isActive || isComplete) && (
                      <p className="text-xs text-gray-500 mt-1">{stage.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          {currentStage === "complete" && (
            <div className="flex justify-end">
              <Button onClick={onCancel} className="bg-purple-600 hover:bg-purple-700 text-white">
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
