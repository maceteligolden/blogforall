"use client";

import type { RoadmapTopic } from "@/lib/writing/roadmap-topic";
import { cn } from "@/lib/utils/cn";

export function TopicSelectCarousel({
  items,
  selectedIndex,
  urgentIndex,
  onSelect,
  loading,
  emptyLabel = "No roadmap topics yet. Approve a roadmap for this campaign first.",
}: {
  items: RoadmapTopic[];
  selectedIndex: number | null;
  urgentIndex?: number;
  onSelect: (sequenceIndex: number) => void;
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading topics…</p>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }
  return (
    <ul className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-gutter:stable]">
      {items.map((item) => {
        const selected = item.sequence_index === selectedIndex;
        const urgentItem = urgentIndex === item.sequence_index;
        return (
          <li key={item.sequence_index} className="snap-start shrink-0 w-[260px]">
            <button
              type="button"
              onClick={() => onSelect(item.sequence_index)}
              className={cn(
                "h-full w-full rounded-xl border p-4 text-left transition-colors",
                selected ? "border-primary bg-primary/10" : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                {urgentItem && <span className="text-[11px] text-primary shrink-0">Urgent</span>}
              </div>
              <p className="text-xs text-gray-400 line-clamp-3">{item.about || item.objective}</p>
              {item.scheduled_at && (
                <p className="mt-2 text-[11px] text-gray-500">Due {new Date(item.scheduled_at).toLocaleDateString()}</p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
