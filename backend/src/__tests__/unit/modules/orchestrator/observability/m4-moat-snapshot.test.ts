import { describe, expect, it } from "@jest/globals";
import { buildV05MoatSnapshot } from "../../../../../modules/orchestrator/ai/observability/moat-snapshot";
import type { WorkflowPhaseEvent } from "../../../../../modules/orchestrator/ai/observability/phase-emitter";

describe("T4.2 moat snapshot", () => {
  it("builds research + optimization snapshot from state and phases", () => {
    const phases: WorkflowPhaseEvent[] = [
      {
        phase: "optimize_gate",
        message: "Gate passed",
        skill_id: "content_optimization",
        meta: {
          overall: 78,
          seo: 80,
          gao: 76,
          quality_gate_passed: true,
          critical_count: 0,
        },
      },
    ];
    const snap = buildV05MoatSnapshot(
      {
        research_package_id: "rp1",
        research_summary: {
          topic: "x",
          depth: "full",
          coverage_score: 0.71,
          source_count: 9,
          contradiction_count: 1,
        },
        optimization_report_id: "opt1",
        optimization_plan: {
          version: 1,
          critical: [],
          high: [],
          medium: [],
          low: [],
          writing_brief: "ok",
        },
        quality_gate_passed: true,
        metadata: {},
      },
      phases,
    );
    expect(snap.research_summary).toMatchObject({
      coverage_score: 0.71,
      source_count: 9,
      contradiction_count: 1,
      package_id: "rp1",
    });
    expect(snap.optimization).toMatchObject({
      overall: 78,
      seo: 80,
      gao: 76,
      quality_gate_passed: true,
      report_id: "opt1",
    });
  });
});
