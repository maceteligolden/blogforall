import { planFromState } from "../plan.policy";
import type { OrchestratorState } from "../state";

/** plan — deterministic policy → PlanResult on state. */
export function planNode(state: OrchestratorState): Partial<OrchestratorState> {
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
}
