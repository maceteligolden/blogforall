import type { WorkflowMode } from "../contracts/enums";
import type { OrchestratorState } from "./state";

const QUICK = /\b(?:quick|rough)\s+draft\b/i;
const STRATEGIST =
  /\b(?:high[- ]quality|strategist|authority|in[- ]depth|comprehensive)\b/i;

/**
 * MVP mode selection (doc 14 §2): quick/urgency → quick_draft;
 * strategist language → strategist_pipeline; else keep chat (plan still runs create path).
 */
export function resolveWorkflowMode(state: OrchestratorState): WorkflowMode {
  if (state.mode !== "chat") return state.mode;

  const ctx = state.conversation_context;
  const isCreate = ctx?.workflow_intent === "create_content";
  if (!isCreate) return "chat";

  if (STRATEGIST.test(state.message)) return "strategist_pipeline";
  if (QUICK.test(state.message) || ctx?.urgency === "high") return "quick_draft";

  // Clear create without strategist cues still uses lite Research (quick_draft).
  return "quick_draft";
}
