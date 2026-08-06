"use client";

import { postTypeLabel, type TopicSuggestion } from "@/lib/types/interactive-post";

type Props = {
  topics: TopicSuggestion[];
  selectedId?: string;
  onSelect: (topic: TopicSuggestion) => void;
  loading?: boolean;
};

export function TopicSuggestionList({ topics, selectedId, onSelect, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-8 text-center text-gray-400">
        Researching your business and campaigns for topic ideas…
      </div>
    );
  }

  if (!topics.length) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-8 text-center text-gray-400">
        No topics yet. Add an optional intent and generate suggestions.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {topics.map((topic) => {
        const selected = topic.id === selectedId;
        return (
          <li key={topic.id}>
            <button
              type="button"
              onClick={() => onSelect(topic)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${
                selected
                  ? "border-primary bg-primary/10"
                  : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-white">{topic.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                  {postTypeLabel(topic.post_type)}
                </span>
              </div>
              <p className="text-sm text-gray-300 mb-3">{topic.about}</p>
              <div className="grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                <p>
                  <span className="text-gray-500">Campaign: </span>
                  {topic.campaign_name || "Evergreen"}
                </p>
                <p>
                  <span className="text-gray-500">Supports: </span>
                  {topic.campaign_support}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {topic.keywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 rounded-full bg-gray-900 text-gray-300 text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
