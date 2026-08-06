/**
 * Writing HITL checkpoint helpers (research → outline → draft).
 */

export type WritingCheckpoint = "research" | "outline";

const APPROVE_LIKE =
  /\b(?:approve(?:\s+the)?\s+(?:research|outline)|continue|looks?\s+good|proceed|go\s+ahead|yes|yep|sure)\b/i;
const REVISE_RESEARCH = /\b(?:revise(?:\s+the)?\s+research|redo\s+(?:the\s+)?research|research\s+again)\b/i;
const REVISE_OUTLINE =
  /\b(?:modify(?:\s+the)?\s+outline|revise(?:\s+the)?\s+outline|change(?:\s+the)?\s+outline|redo\s+(?:the\s+)?outline)\b/i;
const APPROVE_RESEARCH = /\b(?:approve(?:\s+the)?\s+research)\b/i;
const APPROVE_OUTLINE = /\b(?:approve(?:\s+the)?\s+outline)\b/i;

export function isApproveLikeMessage(message: string): boolean {
  return APPROVE_LIKE.test(message.trim());
}

export function isReviseResearchMessage(message: string): boolean {
  return REVISE_RESEARCH.test(message.trim());
}

export function isReviseOutlineMessage(message: string): boolean {
  return REVISE_OUTLINE.test(message.trim());
}

export function isApproveResearchMessage(message: string): boolean {
  return (
    APPROVE_RESEARCH.test(message.trim()) ||
    (/^\s*continue\s*$/i.test(message.trim()) && !REVISE_RESEARCH.test(message))
  );
}

export function isApproveOutlineMessage(message: string): boolean {
  return (
    APPROVE_OUTLINE.test(message.trim()) || (/^\s*continue\s*$/i.test(message.trim()) && !REVISE_OUTLINE.test(message))
  );
}

export type RecoveredWritingState = {
  writing_checkpoint?: WritingCheckpoint;
  research_package_id?: string;
  research_summary?: Record<string, unknown>;
  research_package?: Record<string, unknown>;
  outline?: Record<string, unknown>;
};

type ToolCallLike = {
  tool: string;
  output_data?: Record<string, unknown> | null;
};

type MessageLike = {
  role: string;
  tool_calls?: ToolCallLike[];
};

/**
 * Recover open writing HITL state from recent assistant tool_calls.
 * Stops if a draft tool already ran after the checkpoint.
 */
export function recoverWritingStateFromHistory(messages: MessageLike[]): RecoveredWritingState {
  let research: RecoveredWritingState = {};
  let outline: Record<string, unknown> | undefined;
  let sawDraft = false;

  for (const m of messages) {
    if (m.role !== "assistant" && m.role !== "ASSISTANT") continue;
    for (const call of m.tool_calls ?? []) {
      const data = (call.output_data ?? {}) as Record<string, unknown>;
      const tool = call.tool;
      const action = typeof data.action === "string" ? data.action : undefined;

      if (
        tool === "blogs.generateDraft" ||
        tool === "blogs.createDraft" ||
        tool === "blogs.update" ||
        (tool === "writing" && action === "draft") ||
        (typeof data.blog_id === "string" && data.blog_id && action !== "outline")
      ) {
        sawDraft = true;
      }

      if (tool === "research" || data.research_package || data.research_summary) {
        const pkg =
          data.research_package && typeof data.research_package === "object"
            ? (data.research_package as Record<string, unknown>)
            : undefined;
        const packageId =
          (typeof data.research_package_id === "string" && data.research_package_id) ||
          (typeof pkg?.id === "string" && pkg.id) ||
          undefined;
        research = {
          research_package_id: packageId,
          research_summary:
            data.research_summary && typeof data.research_summary === "object"
              ? (data.research_summary as Record<string, unknown>)
              : undefined,
          research_package: pkg,
        };
        outline = undefined;
      }

      if (
        tool === "writing.outline" ||
        (tool === "writing" && action === "outline") ||
        data.writing_checkpoint === "outline" ||
        data.outline
      ) {
        const ol =
          data.outline && typeof data.outline === "object" ? (data.outline as Record<string, unknown>) : undefined;
        if (ol) outline = ol;
      }
    }
  }

  if (sawDraft) return {};

  if (outline && research.research_package_id) {
    return {
      ...research,
      outline,
      writing_checkpoint: "outline",
    };
  }
  if (research.research_package_id) {
    return {
      ...research,
      writing_checkpoint: "research",
    };
  }
  return {};
}
