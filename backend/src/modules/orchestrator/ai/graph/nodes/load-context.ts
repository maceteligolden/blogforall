import type { MemoryManagerService } from "../../memory/manager/memory-manager";
import type { OrchestratorState } from "../state";

export type LoadContextDeps = {
  memory: Pick<MemoryManagerService, "retrieve">;
};

/** load_context — enrich memory views; no LLM; no understand node. */
export async function loadContextNode(
  state: OrchestratorState,
  deps: LoadContextDeps,
): Promise<Partial<OrchestratorState>> {
  const retrieval = await deps.memory.retrieve({
    workspace_id: state.workspace_id,
    user_id: state.user_id,
    thread_id: state.thread_id,
    profile: "chat_light",
    user_message: state.message,
    topic: state.slots.topic,
  });

  const mode =
    state.mode === "chat" &&
    (state.conversation_context?.workflow_intent === "create_content" ||
      state.conversation_context?.suggested_next_action === "start_content_workflow")
      ? "quick_draft"
      : state.mode;

  return {
    mode,
    memory_views: {
      workspace_slice: retrieval.workspace_slice,
      preferences: retrieval.preferences,
      knowledge: retrieval.knowledge,
      learning: retrieval.learning,
      content_intelligence: retrieval.content_intelligence,
      session_summary: retrieval.session_summary,
      prompt_block: retrieval.prompt_block,
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
