"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PromptAnalysis } from "@/lib/api/services/blog-generation.service";
import { Sparkles, X } from "lucide-react";

interface PreGenerationConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (analysis: PromptAnalysis) => void;
  initialAnalysis: PromptAnalysis;
  isGenerating?: boolean;
}

export function PreGenerationConfirmation({
  isOpen,
  onClose,
  onConfirm,
  initialAnalysis,
  isGenerating = false,
}: PreGenerationConfirmationProps) {
  const [analysis, setAnalysis] = useState<PromptAnalysis>(initialAnalysis);

  const handleConfirm = () => {
    onConfirm(analysis);
  };

  const handleFieldChange = (field: keyof PromptAnalysis, value: string | number | undefined) => {
    setAnalysis((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="bg-gray-900 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Confirm Blog Generation</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <p className="text-sm text-gray-400">
            Review and edit the extracted information before generating your blog post.
          </p>

          <div>
            <Label htmlFor="topic" className="text-gray-300">
              Topic *
            </Label>
            <Input
              id="topic"
              value={analysis.topic}
              onChange={(e) => handleFieldChange("topic", e.target.value)}
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., React Hooks for Beginners"
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="domain" className="text-gray-300">
              Domain *
            </Label>
            <Input
              id="domain"
              value={analysis.domain}
              onChange={(e) => handleFieldChange("domain", e.target.value)}
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., Technology, Health, Finance"
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="target_audience" className="text-gray-300">
              Target Audience *
            </Label>
            <Input
              id="target_audience"
              value={analysis.target_audience}
              onChange={(e) => handleFieldChange("target_audience", e.target.value)}
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., beginners, experts, general public"
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="purpose" className="text-gray-300">
              Purpose *
            </Label>
            <Input
              id="purpose"
              value={analysis.purpose}
              onChange={(e) => handleFieldChange("purpose", e.target.value)}
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., inform, educate, persuade, entertain"
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="structure" className="text-gray-300">
              Structure (Optional)
            </Label>
            <Input
              id="structure"
              value={analysis.structure || ""}
              onChange={(e) => handleFieldChange("structure", e.target.value || undefined)}
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., tutorial, listicle, opinion piece"
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="word_count" className="text-gray-300">
              Word Count (Optional)
            </Label>
            <Input
              id="word_count"
              type="number"
              value={analysis.word_count || ""}
              onChange={(e) =>
                handleFieldChange("word_count", e.target.value ? parseInt(e.target.value, 10) : undefined)
              }
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g., 1500"
              min={300}
              max={5000}
              disabled={isGenerating}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            onClick={onClose}
            disabled={isGenerating}
            className="border border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isGenerating || !analysis.topic || !analysis.domain || !analysis.target_audience || !analysis.purpose}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isGenerating ? "Generating..." : "Generate Blog Post"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
