"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type ResearchFindingItem = {
  text: string;
  value?: string;
};

export type ResearchSourceItem = {
  title: string;
  url?: string;
};

export type ResearchFindingsCardProps = {
  topic?: string;
  facts?: ResearchFindingItem[];
  definitions?: ResearchFindingItem[];
  statistics?: ResearchFindingItem[];
  sources?: ResearchSourceItem[];
  keyInsights?: string[];
  coverageScore?: number;
  sourceCount?: number;
  degraded?: boolean;
  disabled?: boolean;
  onApprove: () => void;
  onRevise: () => void;
  onContinue: () => void;
  className?: string;
};

function FindingList({ items, empty }: { items: ResearchFindingItem[]; empty: string }) {
  if (!items.length) {
    return <p className="text-xs text-gray-500">{empty}</p>;
  }
  return (
    <ul className="space-y-1.5 min-w-0">
      {items.map((item, i) => (
        <li
          key={`${item.text.slice(0, 40)}-${i}`}
          className="text-sm text-gray-200 leading-snug break-words [overflow-wrap:anywhere]"
        >
          <span className="text-gray-500 mr-1.5">•</span>
          {item.text}
          {item.value ? <span className="text-gray-400"> ({item.value})</span> : null}
        </li>
      ))}
    </ul>
  );
}

function ExpandSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-800 pt-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400 hover:text-gray-200"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}
        {title}
        {typeof count === "number" ? <span className="text-gray-600 normal-case">({count})</span> : null}
      </button>
      {open ? <div className="mt-2 pl-5">{children}</div> : null}
    </div>
  );
}

/**
 * In-chat research HITL card — findings stay in the transcript, not the results panel.
 */
export function ResearchFindingsCard({
  topic,
  facts = [],
  definitions = [],
  statistics = [],
  sources = [],
  keyInsights = [],
  coverageScore,
  sourceCount,
  degraded,
  disabled,
  onApprove,
  onRevise,
  onContinue,
  className,
}: ResearchFindingsCardProps) {
  const insights =
    keyInsights.length > 0
      ? keyInsights
      : [...facts, ...definitions, ...statistics]
          .map((f) => f.text.trim())
          .filter(Boolean)
          .slice(0, 4);

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4 space-y-3 min-w-0 max-w-full overflow-hidden",
        className
      )}
      role="region"
      aria-label="Research findings"
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-emerald-500/90">Research ready</p>
          <h3 className="text-sm font-semibold text-white mt-0.5 truncate">
            {topic?.trim() || "Research findings"}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {typeof sourceCount === "number" ? `${sourceCount} sources` : `${sources.length} sources`}
            {typeof coverageScore === "number" ? ` · coverage ${(coverageScore * 100).toFixed(0)}%` : ""}
            {degraded ? " · degraded" : ""}
          </p>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-400 mb-1.5">Key insights</p>
          <ul className="space-y-1">
            {insights.map((line, i) => (
              <li
                key={`${line.slice(0, 32)}-${i}`}
                className="text-sm text-gray-100 break-words [overflow-wrap:anywhere]"
              >
                <span className="text-emerald-500/80 mr-1.5">▸</span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <ExpandSection title="Facts" count={facts.length} defaultOpen={facts.length > 0}>
          <FindingList items={facts} empty="No facts extracted." />
        </ExpandSection>
        <ExpandSection title="Definitions" count={definitions.length} defaultOpen={definitions.length > 0}>
          <FindingList items={definitions} empty="No definitions extracted." />
        </ExpandSection>
        <ExpandSection title="Statistics" count={statistics.length} defaultOpen={statistics.length > 0}>
          <FindingList items={statistics} empty="No statistics extracted." />
        </ExpandSection>
        <ExpandSection title="Sources" count={sources.length} defaultOpen={sources.length > 0 && facts.length === 0}>
          {sources.length === 0 ? (
            <p className="text-xs text-gray-500">No sources listed.</p>
          ) : (
            <ul className="space-y-1.5 min-w-0">
              {sources.map((s, i) => (
                <li key={`${s.title}-${i}`} className="text-sm min-w-0">
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-start gap-1 max-w-full text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
                    >
                      <span className="min-w-0 break-all">{s.title || s.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-gray-300 break-words">{s.title}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ExpandSection>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={disabled}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Approve Research
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onRevise}
          disabled={disabled}
          className="border-gray-700 text-gray-200 hover:bg-gray-800"
        >
          Revise Research
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onContinue}
          disabled={disabled}
          className="text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
