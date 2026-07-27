import { MVP_LOCKS } from "../contracts/mvp-locks";
import { planResultSchema, type PlanResult } from "../contracts/plan-result";
import type { OrchestratorState } from "./state";

/**
 * Deterministic plan policy (M3) — no LLM.
 * Consumes ConversationContext + workflow artifacts; never invents search for Writing.
 */
export function planFromState(state: OrchestratorState): PlanResult {
  const ctx = state.conversation_context;
  const skillsLeft = state.max_skills_per_turn - state.skills_run_this_turn;

  if (skillsLeft <= 0) {
    return planResultSchema.parse({
      next: "compose",
      rationale: "max_skills_per_turn reached; composing with current artifacts",
      workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
    });
  }

  if (ctx?.requires_clarification) {
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "clarify",
      rationale: "CI requires clarification before skills",
    });
  }

  if (ctx?.workflow_intent === "research") {
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "full" },
        workflow_stage: "research",
        rationale: "Research-only turn",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Research package ready",
    });
  }

  if (
    ctx?.workflow_intent === "strategy" ||
    ctx?.suggested_next_action === "start_planning" ||
    ctx?.communicative_category === "brainstorm"
  ) {
    if (!state.strategy) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_strategy",
        skill_args: {},
        workflow_stage: "strategy",
        rationale: "Produce Content Strategy artifact",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Strategy ready",
    });
  }

  /** Strategist: strategy → research(full) → outline → write → optimize → improve* */
  if (state.mode === "strategist_pipeline") {
    if (!state.strategy) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_strategy",
        skill_args: {},
        workflow_stage: "strategy",
        rationale: "Strategist pipeline: Content Strategy first",
      });
    }
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "full" },
        workflow_stage: "research",
        rationale: "Strategist pipeline: Research full package",
      });
    }
    if (!state.outline) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "outline" },
        workflow_stage: "outline",
        rationale: "Strategist pipeline: outline before draft",
      });
    }
    if (!state.draft) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "draft" },
        workflow_stage: "write",
        rationale: "Strategist pipeline: draft from Package (no web search)",
      });
    }
    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: "Strategist pipeline: Content Optimization gate",
      });
    }
    if (
      state.quality_gate_passed === false &&
      state.optimize_count < MVP_LOCKS.optimizeMaxLoops
    ) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: "Strategist pipeline: revise from OptimizationPlan",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Strategist pipeline complete; compose summary",
    });
  }

  const createPath =
    state.mode === "quick_draft" || ctx?.workflow_intent === "create_content";

  if (createPath) {
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "lite" },
        workflow_stage: "research",
        rationale: "Need Research lite package before Writing",
      });
    }
    if (!state.draft) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "draft" },
        workflow_stage: "write",
        rationale: "Draft from Research Package (no web search)",
      });
    }
    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: "Run Content Optimization gate",
      });
    }
    if (
      state.quality_gate_passed === false &&
      state.optimize_count < MVP_LOCKS.optimizeMaxLoops
    ) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: "Revise from OptimizationPlan (loop)",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Create path complete; compose summary",
    });
  }

  if (ctx?.suggested_next_action === "emit_memory_candidate") {
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Preference update → memory candidate on persist",
    });
  }

  return planResultSchema.parse({
    next: "compose",
    workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
    rationale: "Conversational / explain path — compose only",
  });
}
