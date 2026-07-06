import { injectable } from "tsyringe";
import { isDraftApplyRequest } from "../utils/selection-focus.helper";

export type OperationalSessionMode = "planning" | "writing" | "research" | "review" | "casual" | "strategy";

export type ClientSessionMode = OperationalSessionMode | "auto";

export type SessionModeSource = "explicit" | "manual" | "inferred";

export interface SessionModeResolution {
  effectiveMode: OperationalSessionMode;
  source: SessionModeSource;
  /** When explicit switch requests auto, client preference becomes auto */
  clientModeOverride?: ClientSessionMode;
}

const EXPLICIT_SWITCH_PATTERNS: Array<{ pattern: RegExp; mode: ClientSessionMode }> = [
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

const INTENT_KEYWORDS: Array<{ mode: OperationalSessionMode; patterns: RegExp[] }> = [
  {
    mode: "writing",
    patterns: [
      /\b(?:draft|write|edit|rewrite|revise|blog\s+post|generate\s+(?:a\s+)?(?:post|article|blog))\b/i,
      /\b(?:headline|paragraph|excerpt|content\s+for)\b/i,
    ],
  },
  {
    mode: "research",
    patterns: [
      /\b(?:research|search|find\s+(?:out|info)|competitor|trend|statistics|data\s+on|look\s+up)\b/i,
      /\bwhat\s+(?:are|is)\s+(?:people|companies)\s+(?:saying|doing)\b/i,
    ],
  },
  {
    mode: "review",
    patterns: [/\b(?:review|score|critique|feedback\s+on|improve\s+this\s+draft|editorial)\b/i],
  },
  {
    mode: "strategy",
    patterns: [/\b(?:strategy|strategic|themes?|content\s+calendar|posting\s+calendar|roadmap|content\s+pillars?)\b/i],
  },
  {
    mode: "planning",
    patterns: [/\b(?:campaign|schedule|plan\s+(?:my|a|the)|content\s+plan|editorial\s+calendar|launch)\b/i],
  },
];

@injectable()
export class SessionModeRouterService {
  parseExplicitSwitch(message: string): ClientSessionMode | null {
    for (const { pattern, mode } of EXPLICIT_SWITCH_PATTERNS) {
      if (pattern.test(message)) return mode;
    }
    return null;
  }

  resolve(input: {
    clientMode?: ClientSessionMode;
    userMessage: string;
    hasSelectionContext?: boolean;
  }): SessionModeResolution {
    const clientMode: ClientSessionMode = input.clientMode ?? "auto";
    const explicit = this.parseExplicitSwitch(input.userMessage);

    if (explicit === "auto") {
      const effectiveMode = this.inferMode(input.userMessage, input.hasSelectionContext);
      return { effectiveMode, source: "explicit", clientModeOverride: "auto" };
    }

    if (explicit) {
      return { effectiveMode: explicit, source: "explicit", clientModeOverride: explicit };
    }

    if (clientMode !== "auto") {
      return { effectiveMode: clientMode, source: "manual" };
    }

    return {
      effectiveMode: this.inferMode(input.userMessage, input.hasSelectionContext),
      source: "inferred",
    };
  }

  private inferMode(message: string, hasSelectionContext?: boolean): OperationalSessionMode {
    const text = message.trim();
    // Highlight/blog pins default to discussion; only route to writing when the user asks to edit the draft.
    if (hasSelectionContext && isDraftApplyRequest(text)) return "writing";
    if (!text) return "casual";

    for (const { mode, patterns } of INTENT_KEYWORDS) {
      if (patterns.some((p) => p.test(text))) return mode;
    }

    // Short conversational messages default to casual
    if (text.length < 120 && !/\b(?:blog|campaign|draft|schedule|research)\b/i.test(text)) {
      return "casual";
    }

    return "casual";
  }
}
