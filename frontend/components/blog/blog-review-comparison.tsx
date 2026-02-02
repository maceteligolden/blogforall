"use client";

import { useState } from "react";
import { BlogReviewResult } from "@/lib/api/services/blog-review.service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface BlogReviewComparisonProps {
  original: {
    title: string;
    content: string;
    excerpt?: string;
  };
  reviewResult: BlogReviewResult;
  onClose: () => void;
  onApplyAll?: () => void;
}

export function BlogReviewComparison({
  original,
  reviewResult,
  onClose,
  onApplyAll,
}: BlogReviewComparisonProps) {
  const [activeTab, setActiveTab] = useState<"title" | "content" | "excerpt">("content");

  const hasTitleChange = reviewResult.improved_title && reviewResult.improved_title !== original.title;
  const hasContentChange = reviewResult.improved_content && reviewResult.improved_content !== original.content;
  const hasExcerptChange =
    reviewResult.improved_excerpt && reviewResult.improved_excerpt !== original.excerpt;

  const renderDiff = (originalText: string, improvedText: string) => {
    // Simple diff visualization - highlight differences
    const originalLines = originalText.split("\n");
    const improvedLines = improvedText.split("\n");
    const maxLines = Math.max(originalLines.length, improvedLines.length);

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Original */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-red-400 mb-2">Original</h4>
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            {originalLines.map((line, index) => {
              const improvedLine = improvedLines[index];
              const isDifferent = line !== improvedLine;
              return (
                <div
                  key={index}
                  className={`text-sm ${isDifferent ? "bg-red-900/20 text-red-300 line-through" : "text-gray-300"}`}
                >
                  {line || "\u00A0"}
                </div>
              );
            })}
          </div>
        </div>

        {/* Improved */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-green-400 mb-2">Improved</h4>
          <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            {improvedLines.map((line, index) => {
              const originalLine = originalLines[index];
              const isDifferent = line !== originalLine;
              return (
                <div
                  key={index}
                  className={`text-sm ${isDifferent ? "bg-green-900/20 text-green-300 font-medium" : "text-gray-300"}`}
                >
                  {line || "\u00A0"}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="bg-gray-900 border-gray-800 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-2xl font-semibold text-white">Review Comparison</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-6">
          {hasTitleChange && (
            <button
              onClick={() => setActiveTab("title")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "title"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              Title
            </button>
          )}
          {hasContentChange && (
            <button
              onClick={() => setActiveTab("content")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "content"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              Content
            </button>
          )}
          {hasExcerptChange && (
            <button
              onClick={() => setActiveTab("excerpt")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "excerpt"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-300"
              }`}
            >
              Excerpt
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "title" && hasTitleChange && (
            <div className="space-y-4">
              {renderDiff(original.title, reviewResult.improved_title || original.title)}
            </div>
          )}

          {activeTab === "content" && hasContentChange && (
            <div className="space-y-4">
              {renderDiff(original.content, reviewResult.improved_content || original.content)}
            </div>
          )}

          {activeTab === "excerpt" && hasExcerptChange && (
            <div className="space-y-4">
              {renderDiff(original.excerpt || "", reviewResult.improved_excerpt || original.excerpt || "")}
            </div>
          )}

          {!hasTitleChange && !hasContentChange && !hasExcerptChange && (
            <div className="text-center py-12">
              <p className="text-gray-400">No changes detected in this section.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-800">
          <div className="text-sm text-gray-400">
            Review Score: <span className="text-white font-semibold">{reviewResult.overall_score}/100</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Close
            </Button>
            {onApplyAll && (hasTitleChange || hasContentChange || hasExcerptChange) && (
              <Button
                onClick={onApplyAll}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Apply All Changes
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
