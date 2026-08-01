import type { OrchestratorState } from "../graph/state";
import type { WorkflowPhaseEvent } from "../observability/phase-emitter";

export type V05ResearchMoatSnapshot = {
  coverage_score: number;
  source_count: number;
  contradiction_count: number;
  depth?: "lite" | "full";
  degraded?: boolean;
  package_id?: string;
};

export type V05OptimizationMoatSnapshot = {
  overall?: number;
  seo?: number;
  gao?: number;
  quality_gate_passed: boolean;
  critical_count: number;
  report_id?: string;
};

export type V05MoatSnapshot = {
  research_summary?: V05ResearchMoatSnapshot;
  optimization?: V05OptimizationMoatSnapshot;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Build Doc 20 moat snapshot from final state + streamed phase metas. */
export function buildV05MoatSnapshot(
  state: Pick<
    OrchestratorState,
    | "research_summary"
    | "research_package_id"
    | "optimization_report_id"
    | "optimization_plan"
    | "quality_gate_passed"
    | "metadata"
  >,
  phases: readonly WorkflowPhaseEvent[] = []
): V05MoatSnapshot {
  const research_summary = state.research_summary
    ? {
        coverage_score: state.research_summary.coverage_score,
        source_count: state.research_summary.source_count,
        contradiction_count: state.research_summary.contradiction_count,
        depth: state.research_summary.depth,
        degraded: state.research_summary.degraded,
        package_id: state.research_package_id,
      }
    : undefined;

  const gatePhase = [...phases].reverse().find((p) => p.phase === "optimize_gate");
  const fromPhase = gatePhase?.meta;
  const fromMeta = (state.metadata?.quality_scores ?? {}) as Record<string, unknown>;

  const hasGate =
    state.quality_gate_passed !== undefined ||
    fromPhase?.quality_gate_passed !== undefined ||
    num(fromPhase?.overall) !== undefined ||
    num(fromMeta.overall) !== undefined;

  const optimization = hasGate
    ? {
        overall: num(fromPhase?.overall) ?? num(fromMeta.overall),
        seo: num(fromPhase?.seo) ?? num(fromMeta.seo),
        gao: num(fromPhase?.gao) ?? num(fromMeta.gao),
        quality_gate_passed: Boolean(fromPhase?.quality_gate_passed ?? state.quality_gate_passed ?? false),
        critical_count: num(fromPhase?.critical_count) ?? state.optimization_plan?.critical.length ?? 0,
        report_id: state.optimization_report_id,
      }
    : undefined;

  return { research_summary, optimization };
}
