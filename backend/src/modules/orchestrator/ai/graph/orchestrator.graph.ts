import { END, START, StateGraph } from "@langchain/langgraph";
import type { TurnTracer } from "../observability/turn-tracer";
import { routeAfterInvoke, routeAfterPlan } from "./edges";
import { awaitHumanNode } from "./nodes/await-human";
import { composeNode } from "./nodes/compose";
import { invokeSkillNode, type InvokeSkillDeps } from "./nodes/invoke-skill";
import { loadContextNode, type LoadContextDeps } from "./nodes/load-context";
import { planNode, type PlanNodeDeps } from "./nodes/plan";
import { persistNode, type PersistDeps } from "./nodes/persist";
import {
  createInitialOrchestratorState,
  OrchestratorStateAnnotation,
  type OrchestratorState,
} from "./state";
import type { ConversationContext } from "../contracts/conversation-context";
import type { WorkflowMode } from "../contracts/enums";

export type OrchestratorGraphDeps = LoadContextDeps &
  InvokeSkillDeps &
  PersistDeps &
  PlanNodeDeps & {
    tracer?: TurnTracer;
  };

export type InvokeTurnInput = {
  turn_id: string;
  thread_id: string;
  workspace_id: string;
  user_id: string;
  message: string;
  conversation_context: ConversationContext;
  mode?: WorkflowMode;
  campaign_id?: string;
  current_time_iso?: string;
  current_date_human?: string;
};

export function buildOrchestratorGraph(deps: OrchestratorGraphDeps) {
  // Node names must differ from state channels (`plan`, `draft`, …).
  const graph = new StateGraph(OrchestratorStateAnnotation)
    .addNode("load_context", (s) => loadContextNode(s, deps))
    .addNode("plan_turn", (s) => planNode(s, deps))
    .addNode("invoke_skill", (s) => invokeSkillNode(s, deps))
    .addNode("await_human", (s) => awaitHumanNode(s))
    .addNode("compose_reply", (s) => composeNode(s))
    .addNode("persist_turn", (s) => persistNode(s, deps))
    .addEdge(START, "load_context")
    .addEdge("load_context", "plan_turn")
    .addConditionalEdges("plan_turn", routeAfterPlan, {
      invoke_skill: "invoke_skill",
      await_human: "await_human",
      compose: "compose_reply",
      end: END,
    })
    .addConditionalEdges("invoke_skill", routeAfterInvoke, {
      plan: "plan_turn",
      compose: "compose_reply",
    })
    .addEdge("await_human", "persist_turn")
    .addEdge("compose_reply", "persist_turn")
    .addEdge("persist_turn", END);

  return graph.compile();
}

export type CompiledOrchestratorGraph = ReturnType<typeof buildOrchestratorGraph>;

export async function invokeTurn(
  compiled: CompiledOrchestratorGraph,
  input: InvokeTurnInput,
): Promise<OrchestratorState> {
  const now = new Date();
  const initial = createInitialOrchestratorState({
    turn_id: input.turn_id,
    thread_id: input.thread_id,
    workspace_id: input.workspace_id,
    user_id: input.user_id,
    message: input.message,
    mode: input.mode ?? "chat",
    campaign_id: input.campaign_id,
    current_time_iso: input.current_time_iso ?? now.toISOString(),
    current_date_human:
      input.current_date_human ??
      now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
  });

  const seeded: OrchestratorState = {
    ...initial,
    conversation_context: input.conversation_context,
    intent: input.conversation_context.workflow_intent,
    slots: {
      ...initial.slots,
      ...(input.conversation_context.slots_patch ?? {}),
    },
  };

  return compiled.invoke(seeded);
}
