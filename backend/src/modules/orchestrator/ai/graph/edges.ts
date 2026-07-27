import type { PlanResult } from "../contracts/plan-result";
import type { OrchestratorState } from "./state";

export type AfterPlanRoute = "invoke_skill" | "await_human" | "compose" | "end";
export type AfterInvokeRoute = "plan" | "compose";

export function routeAfterPlan(state: OrchestratorState): AfterPlanRoute {
  const next = state.plan?.next ?? "compose";
  if (next === "invoke_skill" || next === "await_human" || next === "compose" || next === "end") {
    return next;
  }
  return "compose";
}

export function routeAfterInvoke(state: OrchestratorState): AfterInvokeRoute {
  if (state.errors.length > 0 && state.recovery?.action === "ask_user") {
    return "compose";
  }
  // Re-plan after each skill so multi-step quick_draft can continue.
  return "plan";
}

export function planNextOrDefault(plan: PlanResult | undefined): AfterPlanRoute {
  return plan?.next ?? "compose";
}
