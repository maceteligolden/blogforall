"use client";

import { BlogReviewResult, ReviewSuggestion } from "@/lib/api/services/blog-review.service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ContentBlock } from "@/lib/types/blog";
import { ArrowLeft } from "lucide-react";

interface ReviewModeViewProps {
  title: string;
  excerpt: string;
  content: string;
  content_blocks?: ContentBlock[] | null;
  reviewResult: BlogReviewResult;
  appliedSuggestionIds: Set<string>;
  onApplySuggestion: (suggestion: ReviewSuggestion) => void;
  onExitReviewMode: () => void;
  isApplyingOne?: boolean;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "critical":
      return "bg-red-900/30 border-red-800 text-red-300";
    case "important":
      return "bg-yellow-900/30 border-yellow-800 text-yellow-300";
    default:
      return "bg-blue-900/30 border-blue-800 text-blue-300";
  }
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    readability: "Readability",
    seo: "SEO",
    grammar: "Grammar",
    structure: "Structure",
    "fact-check": "Fact Check",
    style: "Style",
    engagement: "Engagement",
    other: "Other",
  };
  return labels[type] || type;
}

/** Read-only post view with suggestion list; each suggestion has Apply (calls apply-one API). */
export function ReviewModeView({
  title,
  excerpt,
  content,
  content_blocks,
  reviewResult,
  appliedSuggestionIds,
  onApplySuggestion,
  onExitReviewMode,
  isApplyingOne,
}: ReviewModeViewProps) {
  const hasBlocks = content_blocks != null && content_blocks.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={onExitReviewMode}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to edit
        </Button>
        <div className="text-sm text-gray-400">
          Review mode — apply suggestions below; use version history to undo
        </div>
      </div>

      <Card className="bg-gray-900 border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-2 border-b border-gray-800 pb-2">
          Post preview (read-only)
        </h2>
        <div className="prose prose-invert max-w-none space-y-4">
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Title</div>
            <div className="text-xl font-semibold text-white">{title || "(No title)"}</div>
          </div>
          {excerpt && (
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">Excerpt</div>
              <div className="text-gray-300">{excerpt}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-gray-500 uppercase mb-1">Content</div>
            {hasBlocks ? (
              <div className="space-y-3 text-gray-300">
                {content_blocks!.map((block) => (
                  <div key={block.id} className="border-l-2 border-gray-700 pl-3">
                    {block.type === "paragraph" && <p>{block.data.text as string}</p>}
                    {block.type === "heading" && (
                      <p
                            className={`font-semibold ${
                              block.data.level === 1 ? "text-xl" : block.data.level === 2 ? "text-lg" : "text-base"
                            }`}
                          >
                            {block.data.text as string}
                          </p>
                        )}
                    {block.type === "list" && (
                      <ul className="list-disc list-inside">
                        {(block.data.items as string[] ?? []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {block.type === "blockquote" && (
                      <blockquote className="border-gray-600 italic">{block.data.text as string}</blockquote>
                    )}
                    {block.type === "code" && (
                      <pre className="bg-gray-800 rounded p-2 text-sm overflow-x-auto">
                        <code>{block.data.text as string}</code>
                      </pre>
                    )}
                    {block.type === "image" && (
                      <div className="text-gray-500">
                        [Image: {block.data.caption as string ?? "no caption"}]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="text-gray-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: content || "" }}
              />
            )}
          </div>
        </div>
      </Card>

      <Card className="bg-gray-900 border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Suggestions — Apply individually</h2>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {reviewResult.suggestions.map((suggestion, index) => {
            const id = suggestion.id ?? String(index);
            const applied = appliedSuggestionIds.has(id);
            return (
              <div
                key={id}
                className={`border rounded-lg p-4 ${
                  applied ? "border-gray-700 bg-gray-800/30 opacity-75" : "border-gray-700 bg-gray-800/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={getPriorityColor(suggestion.priority)}>{suggestion.priority}</Badge>
                    <Badge variant="outline" className="border-gray-600 text-gray-300">
                      {getTypeLabel(suggestion.type)}
                    </Badge>
                    {suggestion.target && (
                      <span className="text-xs text-gray-500">Target: {suggestion.target}</span>
                    )}
                  </div>
                  {!applied && (
                    <Button
                      size="sm"
                      onClick={() => onApplySuggestion(suggestion)}
                      disabled={isApplyingOne}
                      className="shrink-0"
                    >
                      {isApplyingOne ? "Applying…" : "Apply"}
                    </Button>
                  )}
                  {applied && (
                    <span className="text-xs text-gray-500 shrink-0">Applied</span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Original: </span>
                    <span className="text-gray-300 line-through">{suggestion.original}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Suggestion: </span>
                    <span className="text-white">{suggestion.suggestion}</span>
                  </div>
                  <p className="text-gray-400">{suggestion.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
