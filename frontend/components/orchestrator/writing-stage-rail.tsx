"use client";

import { cn } from "@/lib/utils/cn";

export type WritingStagePhase = {
  phase: string;
  message: string;
  percent?: number;
};

const PHASE_LABEL: Record<string, string> = {
  strategy: "Planning",
  research: "Researching",
  research_planning: "Researching",
  research_gathering: "Researching",
  research_structuring: "Researching",
  research_packaging: "Research ready",
  outline: "Planning structure",
  draft: "Generating draft",
  write: "Generating draft",
  optimize: "Reviewing quality",
  optimize_scoring: "SEO & quality checks",
  optimize_gate: "Campaign & strategy checks",
  improve: "Improving draft",
  clarify: "Quick check",
  draft_ready: "Draft ready",
};

interface WritingStageRailProps {
  phases: WritingStagePhase[];
  className?: string;
}

/**
 * Progressive writing-stage history from realtime ORCHESTRATOR_PHASE events.
 */
export function WritingStageRail({ phases, className }: WritingStageRailProps) {
  if (phases.length === 0) return null;

  return (
    <div
      className={cn("mx-4 md:mx-6 mb-2 rounded-lg border border-gray-800 bg-gray-950/80 px-3 py-2", className)}
      role="status"
      aria-live="polite"
    >
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Writing stages</p>
      <ol className="space-y-1">
        {phases.map((p, i) => {
          const label = PHASE_LABEL[p.phase] ?? p.phase;
          const isLatest = i === phases.length - 1;
          return (
            <li
              key={`${p.phase}-${i}-${p.message.slice(0, 24)}`}
              className={cn("flex items-start gap-2 text-xs", isLatest ? "text-gray-100" : "text-gray-500")}
            >
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                  isLatest ? "bg-primary animate-pulse" : "bg-gray-600"
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="font-medium">{label}</span>
                <span className="text-gray-400"> — {p.message}</span>
                {p.percent != null && isLatest ? <span className="text-gray-500"> ({p.percent}%)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
