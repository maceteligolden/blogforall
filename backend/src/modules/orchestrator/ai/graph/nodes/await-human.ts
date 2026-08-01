import type { OrchestratorState } from "../state";

/** await_human — park confirmation on state; set reply if missing. */
export function awaitHumanNode(state: OrchestratorState): Partial<OrchestratorState> {
  const confirmation = state.plan?.confirmation ?? state.awaiting_confirmation;
  const reply = state.reply ?? confirmation?.summary ?? "I need your confirmation before continuing.";
  return {
    awaiting_confirmation: confirmation,
    reply,
    progress_events: [
      {
        type: "await_human",
        message: confirmation?.summary ?? "Awaiting user confirmation",
        at: new Date().toISOString(),
      },
    ],
  };
}
