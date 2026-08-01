"use client";

import { cn } from "@/lib/utils/cn";
import type { V05MoatSnapshot } from "@/lib/api/types/orchestrator.types";

export type MoatScoreStripProps = {
  moat: V05MoatSnapshot;
  className?: string;
};

/**
 * Doc 20 moat visibility — research package coverage + SEO/GAO scorecard.
 */
export function MoatScoreStrip({ moat, className }: MoatScoreStripProps) {
  const research = moat.research_summary;
  const opt = moat.optimization;
  if (!research && !opt) return null;

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-snug text-gray-400 border-t border-gray-800/80 pt-2",
        className
      )}
      data-testid="moat-score-strip"
    >
      {research && (
        <span>
          Package coverage <span className="text-gray-200 font-medium">{research.coverage_score.toFixed(2)}</span>
          <span className="text-gray-500"> · {research.source_count} sources</span>
          {research.contradiction_count > 0 && (
            <span className="text-amber-400/90"> · {research.contradiction_count} contradictions</span>
          )}
        </span>
      )}
      {opt && (
        <span>
          {typeof opt.seo === "number" && (
            <>
              SEO <span className="text-gray-200 font-medium">{Math.round(opt.seo)}</span>
              {" · "}
            </>
          )}
          {typeof opt.gao === "number" && (
            <>
              GAO <span className="text-gray-200 font-medium">{Math.round(opt.gao)}</span>
              {" · "}
            </>
          )}
          {typeof opt.overall === "number" && (
            <>
              overall <span className="text-gray-200 font-medium">{Math.round(opt.overall)}</span>
              {" · "}
            </>
          )}
          <span className={opt.quality_gate_passed ? "text-emerald-400/90" : "text-amber-400/90"}>
            gate {opt.quality_gate_passed ? "passed" : "needs work"}
          </span>
        </span>
      )}
    </div>
  );
}
