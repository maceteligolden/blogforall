import { planFromState } from "../plan.policy";
import type { OrchestratorState } from "../state";
import type { TurnTracer } from "../../observability/turn-tracer";

export type PlanNodeDeps = {
  tracer?: TurnTracer;
};

/** plan — deterministic policy → PlanResult on state. */
export function planNode(
  state: OrchestratorState,
  deps: PlanNodeDeps = {},
): Partial<OrchestratorState> {
  const run = (): Partial<OrchestratorState> => {
    const plan = planFromState(state);
    return {
      plan,
      active_skill: plan.skill_id,
      skill_args: plan.skill_args,
      workflow_stage: plan.workflow_stage ?? state.workflow_stage,
      awaiting_confirmation: plan.confirmation,
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
