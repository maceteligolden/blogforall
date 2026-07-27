import { stripDisallowedCheckpointFields } from "../checkpoint-allowlist";
import type { MemoryManagerService } from "../../memory/manager/memory-manager";
import type { OrchestratorState } from "../state";

export type PersistDeps = {
  memory: Pick<MemoryManagerService, "rememberAsync">;
};

/**
 * persist — enqueue memory candidates; strip disallowed checkpoint fields from views.
 * Message persistence stays in OrchestratorService (same as cognition path).
 */
export async function persistNode(
  state: OrchestratorState,
  deps: PersistDeps,
): Promise<Partial<OrchestratorState>> {
  for (const candidate of state.memory_candidates) {
    await deps.memory.rememberAsync(candidate, { turn_id: state.turn_id });
  }

  const sanitized = stripDisallowedCheckpointFields({
    research_package: state.research_package,
    draft: state.draft,
  } as Record<string, unknown>);

  return {
    // Drop same-turn hydrate bodies from outgoing state when denylisted
    research_package: sanitized.research_package as OrchestratorState["research_package"],
    progress_events: [
      {
        type: "persist",
        message: `Enqueued ${state.memory_candidates.length} memory candidate(s)`,
        at: new Date().toISOString(),
      },
    ],
  };
}
