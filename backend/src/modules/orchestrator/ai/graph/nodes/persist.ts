import { stripDisallowedCheckpointFields } from "../checkpoint-allowlist";
import type { MemoryManagerService } from "../../memory/manager/memory-manager";
import type { TurnTracer } from "../../observability/turn-tracer";
import type { OrchestratorState } from "../state";

export type PersistDeps = {
  memory: Pick<MemoryManagerService, "rememberAsync">;
  tracer?: TurnTracer;
};

/**
 * persist — enqueue memory candidates; strip disallowed checkpoint fields from views.
 * Message persistence stays in OrchestratorService (same as cognition path).
 */
export async function persistNode(state: OrchestratorState, deps: PersistDeps): Promise<Partial<OrchestratorState>> {
  const run = async (): Promise<Partial<OrchestratorState>> => {
    for (const candidate of state.memory_candidates) {
      const { job_id } = await deps.memory.rememberAsync(candidate, { turn_id: state.turn_id });
      deps.tracer
        ?.startSpan("memory.remember.enqueue", {
          turn_id: state.turn_id,
          workspace_id: state.workspace_id,
          memory_job_id: job_id,
          layer: candidate.proposed_layer,
        })
        .end({
          status: "ok",
          attrs: { memory_job_id: job_id },
        });
    }

    const sanitized = stripDisallowedCheckpointFields({
      research_package: state.research_package,
      draft: state.draft,
    } as Record<string, unknown>);

    return {
      research_package: sanitized.research_package as OrchestratorState["research_package"],
      progress_events: [
        {
          type: "persist",
          message: `Enqueued ${state.memory_candidates.length} memory candidate(s)`,
          at: new Date().toISOString(),
        },
      ],
    };
  };

  if (!deps.tracer) return run();
  return deps.tracer.timed("persist", { turn_id: state.turn_id, workspace_id: state.workspace_id }, async (span) => {
    const patch = await run();
    span.setAttributes({ candidates: state.memory_candidates.length });
    return patch;
  });
}
