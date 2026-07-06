import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import { listMissingOnboardingFields } from "./onboarding-interview.helper";

const CASUAL_FOLLOW_UPS = [
  "What's the main goal you're working toward with your content right now?",
  "Who are you trying to reach with your posts?",
  "How would you describe your brand voice in a few words?",
  "What topics or themes matter most to your audience?",
  "Is there anything about your business I should keep in mind for future drafts?",
];

function endsWithQuestion(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith("?") || /\?\s*$/.test(trimmed);
}

function pickFollowUp(memory: WorkspaceMemory): string {
  const missing = listMissingOnboardingFields(memory);
  if (missing.includes("target_audience")) {
    return "Who is your primary target audience?";
  }
  if (missing.includes("brand_voice")) {
    return "How should your content sound — formal, playful, expert, or something else?";
  }
  if (missing.includes("business_goals")) {
    return "What are your top goals for content right now?";
  }
  const idx = Math.floor(Math.random() * CASUAL_FOLLOW_UPS.length);
  return CASUAL_FOLLOW_UPS[idx] ?? CASUAL_FOLLOW_UPS[0];
}

/**
 * Light repair for casual turns: if the assistant reply is very short and
 * doesn't invite continuation, append a natural follow-up question.
 */
export function ensureCasualConversationReply(
  reply: string | null | undefined,
  memory: WorkspaceMemory
): { reply: string; repaired: boolean } {
  const text = (reply ?? "").trim();
  if (!text) {
    return { reply: pickFollowUp(memory), repaired: true };
  }
  if (endsWithQuestion(text)) {
    return { reply: text, repaired: false };
  }
  if (text.length < 80) {
    const followUp = pickFollowUp(memory);
    return { reply: `${text}\n\n${followUp}`, repaired: true };
  }
  return { reply: text, repaired: false };
}
