import { planFromState } from "../plan.policy";
import type { OrchestratorState } from "../state";
import type { TurnTracer } from "../../observability/turn-tracer";

export type PlanNodeDeps = {
  tracer?: TurnTracer;
};

/** plan — deterministic policy → PlanResult on state. */
export function planNode(state: OrchestratorState, deps: PlanNodeDeps = {}): Partial<OrchestratorState> {
  const run = (): Partial<OrchestratorState> => {
    const plan = planFromState(state);
    const revise = plan.skill_args?.revise === true;
    const meta: Record<string, unknown> = { ...(state.metadata ?? {}) };

    if (plan.confirmation?.kind === "research_approval" || plan.workflow_stage === "research") {
      if (plan.next === "compose" && plan.confirmation?.kind === "research_approval") {
        meta.writing_checkpoint = "research";
      }
    }
    if (plan.confirmation?.kind === "outline_approval" || plan.workflow_stage === "outline") {
      if (plan.next === "compose" && plan.confirmation?.kind === "outline_approval") {
        meta.writing_checkpoint = "outline";
      }
    }
    if (plan.skill_id === "writing" && plan.skill_args?.action === "outline") {
      delete meta.writing_checkpoint;
    }
    if (plan.skill_id === "writing" && plan.skill_args?.action === "draft") {
      delete meta.writing_checkpoint;
    }
    if (revise && plan.skill_id === "research") {
      delete meta.writing_checkpoint;
    }

    const clearResearch = revise && plan.skill_id === "research";
    const clearOutline = revise && plan.skill_id === "writing" && plan.skill_args?.action === "outline";

    return {
      plan,
      active_skill: plan.skill_id,
      skill_args: plan.skill_args,
      workflow_stage: plan.workflow_stage ?? state.workflow_stage,
      awaiting_confirmation: plan.confirmation,
      metadata: meta,
      ...(clearResearch
        ? {
            research_package_id: undefined,
            research_package: undefined,
            research_summary: undefined,
            outline: undefined,
          }
        : {}),
      ...(clearOutline ? { outline: undefined } : {}),
      ...(plan.confirmation?.summary && plan.next === "compose" && !state.reply?.trim()
        ? { reply: plan.confirmation.summary }
        : {}),
      progress_events: [
        {
          type: "plan",
          message: plan.rationale,
          at: new Date().toISOString(),
          meta: { next: plan.next, skill_id: plan.skill_id },
        },
      ],
    };
  };

  if (!deps.tracer) return run();
  const span = deps.tracer.startSpan("plan", {
    turn_id: state.turn_id,
    workspace_id: state.workspace_id,
  });
  try {
    const patch = run();
    span.end({
      status: "ok",
      attrs: {
        next: patch.plan?.next,
        skill_id: patch.plan?.skill_id,
        workflow_stage: patch.workflow_stage,
      },
    });
    return patch;
  } catch (e) {
    span.end({
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
