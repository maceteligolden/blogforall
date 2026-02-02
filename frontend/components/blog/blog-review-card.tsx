"use client";

import { useState } from "react";
import { BlogReviewResult, ReviewSuggestion } from "@/lib/api/services/blog-review.service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface BlogReviewCardProps {
  reviewResult: BlogReviewResult;
  onApplyReview?: (selectedSuggestions: string[]) => void;
  onViewComparison?: () => void;
  isLoading?: boolean;
}

export function BlogReviewCard({ reviewResult, onApplyReview, onViewComparison, isLoading }: BlogReviewCardProps) {
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());

  const toggleSuggestion = (index: number) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedSuggestions(newSelected);
  };

  const handleApplySelected = () => {
    if (onApplyReview && selectedSuggestions.size > 0) {
      onApplyReview(Array.from(selectedSuggestions).map(String));
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-900/30 border-red-800 text-red-300";
      case "important":
        return "bg-yellow-900/30 border-yellow-800 text-yellow-300";
      case "nice-to-have":
        return "bg-blue-900/30 border-blue-800 text-blue-300";
      default:
        return "bg-gray-900/30 border-gray-800 text-gray-300";
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      readability: "Readability",
      seo: "SEO",
      grammar: "Grammar",
      structure: "Structure",
      "fact-check": "Fact Check",
      style: "Style",
      other: "Other",
    };
    return labels[type] || type;
  };

  return (
    <Card className="bg-gray-900 border-gray-800 p-6 space-y-6">
      {/* Overall Score */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-2">
          <h3 className="text-xl font-semibold text-white">Overall Score</h3>
          <span className={`text-4xl font-bold ${getScoreColor(reviewResult.overall_score)}`}>
            {reviewResult.overall_score}
          </span>
          <span className="text-gray-400">/100</span>
        </div>
        <Progress value={reviewResult.overall_score} className="h-2" />
      </div>

      {/* Category Scores */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Object.entries(reviewResult.scores).map(([key, score]) => (
          <div key={key} className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 capitalize">{key.replace("_", " ")}</span>
              <span className={`text-sm font-semibold ${getScoreColor(score)}`}>{score}</span>
            </div>
            <Progress value={score} className="h-1" />
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-2">Review Summary</h4>
        <p className="text-sm text-gray-300">{reviewResult.summary}</p>
      </div>

      {/* Suggestions */}
      {reviewResult.suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-white">
              Suggestions ({reviewResult.suggestions.length})
            </h4>
            {onViewComparison && (
              <Button
                variant="outline"
                size="sm"
                onClick={onViewComparison}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                View Comparison
              </Button>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {reviewResult.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedSuggestions.has(index)
                    ? "border-primary bg-primary/10"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
                onClick={() => toggleSuggestion(index)}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getPriorityColor(suggestion.priority)}>
                      {suggestion.priority}
                    </Badge>
                    <Badge variant="outline" className="border-gray-700 text-gray-300">
                      {getTypeLabel(suggestion.type)}
                    </Badge>
                    {suggestion.line && (
                      <span className="text-xs text-gray-500">Line {suggestion.line}</span>
                    )}
                    {suggestion.section && (
                      <span className="text-xs text-gray-500">{suggestion.section}</span>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedSuggestions.has(index)}
                    onChange={() => toggleSuggestion(index)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Original:</p>
                    <p className="text-sm text-gray-300 bg-gray-900/50 rounded p-2 line-through">
                      {suggestion.original}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Suggestion:</p>
                    <p className="text-sm text-white bg-gray-900/50 rounded p-2">
                      {suggestion.suggestion}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Explanation:</p>
                    <p className="text-sm text-gray-300">{suggestion.explanation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Apply Selected Button */}
          {selectedSuggestions.size > 0 && onApplyReview && (
            <div className="pt-4 border-t border-gray-700">
              <Button
                onClick={handleApplySelected}
                disabled={isLoading}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                {isLoading ? "Applying..." : `Apply ${selectedSuggestions.size} Selected Suggestion(s)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
