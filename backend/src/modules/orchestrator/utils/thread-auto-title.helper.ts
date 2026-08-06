import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorThread } from "../../../shared/schemas/orchestrator-thread.schema";

const DEFAULT_TITLES = new Set(["new conversation", "workspace onboarding"]);

export function countUserMessages(messages: OrchestratorMessage[]): number {
  return messages.filter((m) => m.role === OrchestratorMessageRole.USER).length;
}

/**
 * Whether we should attempt an LLM auto-title for this thread.
 * Only once, only for default titles on non-onboarding active chats, after ≥2 user turns.
 */
export function shouldAutoTitleThread(
  thread: Pick<OrchestratorThread, "is_onboarding" | "title" | "title_source">,
  messages: OrchestratorMessage[]
): boolean {
  if (thread.is_onboarding) return false;
  const source = thread.title_source ?? "default";
  if (source !== "default") return false;
  const title = (thread.title || "").trim().toLowerCase();
  if (title && !DEFAULT_TITLES.has(title)) {
    // Legacy threads without title_source but already renamed.
    return false;
  }
  return countUserMessages(messages) >= 2;
}

/** Build a compact transcript for the title LLM. */
export function buildAutoTitlePromptContext(messages: OrchestratorMessage[], maxMessages = 8): string {
  return messages
    .slice(-maxMessages)
    .map((m) => {
      const role = m.role === OrchestratorMessageRole.ASSISTANT ? "Assistant" : "User";
      const content = (m.content || "").replace(/\s+/g, " ").trim().slice(0, 400);
      return `${role}: ${content}`;
    })
    .filter((line) => line.length > 10)
    .join("\n");
}

export function sanitizeGeneratedTitle(raw: string): string | null {
  let t = raw.trim().replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return null;
  // Drop trailing periods / question marks for list UI.
  t = t.replace(/[.?!]+$/g, "").trim();
  if (t.length < 3) return null;
  if (t.length > 80) t = `${t.slice(0, 77).trim()}…`;
  if (DEFAULT_TITLES.has(t.toLowerCase())) return null;
  return t;
}
