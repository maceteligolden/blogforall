"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type OutlineApprovalCardProps = {
  title?: string;
  sections?: Array<{ heading: string; summary?: string }>;
  disabled?: boolean;
  onApprove: () => void;
  onModify: () => void;
  onContinue: () => void;
  className?: string;
};

/**
 * In-chat outline HITL card — structure review before drafting.
 */
export function OutlineApprovalCard({
  title,
  sections = [],
  disabled,
  onApprove,
  onModify,
  onContinue,
  className,
}: OutlineApprovalCardProps) {
  const headings = sections.map((s) => s.heading).filter(Boolean);

  return (
    <div
      className={cn("rounded-xl border border-sky-800/50 bg-sky-950/20 p-4 space-y-3", className)}
      role="region"
      aria-label="Outline approval"
    >
      <div>
        <p className="text-[10px] uppercase tracking-widest text-sky-500/90">Outline ready</p>
        <h3 className="text-sm font-semibold text-white mt-0.5">
          {title?.trim() || "Proposed outline"}
        </h3>
        <p className="text-xs text-gray-400 mt-1">
          {headings.length ? `${headings.length} sections` : "Review the structure before drafting"}
        </p>
      </div>

      {headings.length > 0 ? (
        <ol className="space-y-2 list-decimal list-inside">
          {sections.map((section, i) => (
            <li key={`${section.heading}-${i}`} className="text-sm text-gray-100">
              <span className="font-medium">{section.heading}</span>
              {section.summary?.trim() ? (
                <p className="text-xs text-gray-400 mt-0.5 ml-5 pl-0.5">{section.summary}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-gray-400">Outline headings weren’t available — continue to draft anyway, or modify.</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          size="sm"
          onClick={onApprove}
          disabled={disabled}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Approve Outline
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onModify}
          disabled={disabled}
          className="border-gray-700 text-gray-200 hover:bg-gray-800"
        >
          Modify Outline
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
