import type { MemoryManagerService } from "../../memory/manager/memory-manager";
import type { TurnTracer } from "../../observability/turn-tracer";
import { resolveWorkflowMode } from "../resolve-mode";
import type { OrchestratorState } from "../state";
import { env } from "../../../../../shared/config/env";
import type { StrategicContextLoader } from "../../strategic-context";

export type LoadContextDeps = {
  memory: Pick<MemoryManagerService, "retrieve">;
  tracer?: TurnTracer;
  strategicContext?: StrategicContextLoader;
};

/** load_context — enrich memory views; no LLM; no understand node. */
export async function loadContextNode(
  state: OrchestratorState,
  deps: LoadContextDeps,
): Promise<Partial<OrchestratorState>> {
  const run = async (): Promise<Partial<OrchestratorState>> => {
    const existing = state.memory_views as { profile?: string; prompt_block?: string } | undefined;
    if (existing?.profile === "chat_light" && existing.prompt_block !== undefined) {
      return {
        mode: resolveWorkflowMode(state),
        progress_events: [
          {
            type: "load_context",
            message: "Skipped duplicate chat_light retrieve",
            at: new Date().toISOString(),
          },
        ],
      };
    }

    const profile =
      env.orchestrator.strategicIntelligenceEnabled &&
      (state.mode === "strategist_pipeline" ||
        state.conversation_context?.workflow_intent === "create_content")
        ? "strategy_full"
        : "chat_light";

    const retrieval = await deps.memory.retrieve({
      workspace_id: state.workspace_id,
      user_id: state.user_id,
      thread_id: state.thread_id,
      profile,
      user_message: state.message,
      topic: state.slots.topic,
    });

    let strategicMeta: Record<string, unknown> = {};
    let prompt_block = retrieval.prompt_block ?? "";
    let campaign_id = state.campaign_id;

    if (env.orchestrator.strategicIntelligenceEnabled && deps.strategicContext) {
      const ctx = await deps.strategicContext.load(
        state.workspace_id,
        state.user_id,
        state.campaign_id,
      );
      strategicMeta = {
        ...ctx.metadata,
        campaign_resolved: true,
      };
      if (ctx.prompt_suffix) {
        prompt_block = `${prompt_block}\n\n${ctx.prompt_suffix}`.trim();
      }
      if (!campaign_id && ctx.campaign_id) {
        campaign_id = ctx.campaign_id;
      }
    }

    return {
      mode: resolveWorkflowMode(state),
      campaign_id,
      metadata: {
        ...state.metadata,
        ...strategicMeta,
      },
      memory_views: {
        workspace_slice: retrieval.workspace_slice,
        preferences: retrieval.preferences,
        knowledge: retrieval.knowledge,
        learning: retrieval.learning,
        content_intelligence: retrieval.content_intelligence,
        session_summary: retrieval.session_summary,
        prompt_block,
        profile,
        token_budget_used: retrieval.token_budget_used,
      },
      progress_events: [
        {
          type: "load_context",
          message: `Memory views loaded (${profile})`,
          at: new Date().toISOString(),
          meta: { token_budget_used: retrieval.token_budget_used },
        },
      ],
    };
  };

  if (!deps.tracer) return run();
  return deps.tracer.timed(
    "memory.retrieve",
    { profile: "load_context", turn_id: state.turn_id, workspace_id: state.workspace_id },
    async (span) => {
      const patch = await run();
      const first = patch.progress_events?.[0];
      span.setAttributes({
        token_budget_used: (first?.meta as { token_budget_used?: number } | undefined)
          ?.token_budget_used,
        skipped: first?.message?.includes("Skipped") ?? false,
      });
      return patch;
    },
  );
}
