import type { MemoryManagerService } from "../../memory/manager/memory-manager";
import { resolveWorkflowMode } from "../resolve-mode";
import type { OrchestratorState } from "../state";

export type LoadContextDeps = {
  memory: Pick<MemoryManagerService, "retrieve">;
};

/** load_context — enrich memory views; no LLM; no understand node. */
export async function loadContextNode(
  state: OrchestratorState,
  deps: LoadContextDeps,
): Promise<Partial<OrchestratorState>> {
  // Parity: do not re-fetch identical chat_light if already loaded this turn.
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

  const retrieval = await deps.memory.retrieve({
    workspace_id: state.workspace_id,
    user_id: state.user_id,
    thread_id: state.thread_id,
    profile: "chat_light",
    user_message: state.message,
    topic: state.slots.topic,
  });

  return {
    mode: resolveWorkflowMode(state),
    memory_views: {
      workspace_slice: retrieval.workspace_slice,
      preferences: retrieval.preferences,
      knowledge: retrieval.knowledge,
      learning: retrieval.learning,
      content_intelligence: retrieval.content_intelligence,
      session_summary: retrieval.session_summary,
      prompt_block: retrieval.prompt_block,
      profile: "chat_light",
    },
    progress_events: [
      {
        type: "load_context",
        message: "Memory views loaded (chat_light)",
        at: new Date().toISOString(),
      },
    ],
  };
}
