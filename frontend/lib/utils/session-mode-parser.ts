import type { OperationalSessionMode, OrchestratorSessionMode } from "@/lib/types/orchestrator-session.types";

export type ClientSessionMode = OrchestratorSessionMode;

const EXPLICIT_SWITCH_PATTERNS: Array<{ pattern: RegExp; mode: OrchestratorSessionMode }> = [
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?auto(?:\s+mode)?\b/i, mode: "auto" },
  { pattern: /\b(?:back\s+to\s+)?auto\s+mode\b/i, mode: "auto" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?(?:writing|write)(?:\s+mode)?\b/i, mode: "writing" },
  { pattern: /\bwriting\s+mode\b/i, mode: "writing" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?(?:research|researching)(?:\s+mode)?\b/i, mode: "research" },
  { pattern: /\bresearch\s+mode\b/i, mode: "research" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?(?:review|reviewing)(?:\s+mode)?\b/i, mode: "review" },
  { pattern: /\breview\s+mode\b/i, mode: "review" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?(?:planning|plan)(?:\s+mode)?\b/i, mode: "planning" },
  { pattern: /\bplanning\s+mode\b/i, mode: "planning" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?(?:strategy|strategic)(?:\s+mode)?\b/i, mode: "strategy" },
  { pattern: /\bstrategy\s+mode\b/i, mode: "strategy" },
  { pattern: /\b(?:switch|change|go)\s+(?:to\s+)?casual(?:\s+mode)?\b/i, mode: "casual" },
  { pattern: /\bcasual\s+mode\b/i, mode: "casual" },
];

export function parseExplicitSessionModeSwitch(message: string): OrchestratorSessionMode | null {
  for (const { pattern, mode } of EXPLICIT_SWITCH_PATTERNS) {
    if (pattern.test(message)) return mode;
  }
  return null;
}

export function isWritingEffectiveMode(
  sessionMode: OrchestratorSessionMode,
  effectiveSessionMode: OperationalSessionMode
): boolean {
  return sessionMode === "writing" || (sessionMode === "auto" && effectiveSessionMode === "writing");
}
