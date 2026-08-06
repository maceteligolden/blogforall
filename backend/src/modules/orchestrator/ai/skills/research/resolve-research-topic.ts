import type { OrchestratorState } from "../../graph/state";

const HITL_MSG =
  /^(?:approve|revise|modify|continue)\b|\b(?:approve|revise|modify)(?:\s+the)?\s+(?:research|outline)\b/i;

/**
 * Resolve a stable research topic. Never use HITL button text ("Revise the research") as the topic.
 */
export function resolveResearchTopic(state: Pick<
  OrchestratorState,
  "message" | "slots" | "research_summary" | "research_package" | "recent_messages"
>): string {
  const slot = typeof state.slots.topic === "string" ? state.slots.topic.trim() : "";
  if (slot) return slot;

  const fromSummary =
    typeof state.research_summary?.topic === "string" ? state.research_summary.topic.trim() : "";
  if (fromSummary && !HITL_MSG.test(fromSummary)) return fromSummary;

  const fromPkg =
    typeof state.research_package?.topic === "string" ? state.research_package.topic.trim() : "";
  if (fromPkg && !HITL_MSG.test(fromPkg)) return fromPkg;

  const fromHistory = (state.recent_messages ?? [])
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter((c) => c.length > 2 && !HITL_MSG.test(c) && !/^(yes|no|yep|sure|ok)$/i.test(c));
  const lastUser = fromHistory[fromHistory.length - 1];
  if (lastUser) {
    // Prefer topic after soft create: "it should cover saas" / "about nelson mandela"
    const about = lastUser.match(/\b(?:about|on|cover(?:ing)?|regarding)\s+(.+)$/i);
    if (about?.[1]?.trim()) return about[1].trim().replace(/[.?!]+$/, "").slice(0, 160);
    return lastUser.slice(0, 160);
  }

  const msg = (state.message ?? "").trim();
  if (msg && !HITL_MSG.test(msg)) return msg.slice(0, 160);
  return "the requested topic";
}
