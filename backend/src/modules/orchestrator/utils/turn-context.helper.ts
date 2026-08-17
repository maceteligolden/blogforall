import { buildHighlightContextBlock, type SelectionContextPayload } from "./selection-focus.helper";

export type OperationalSessionMode = "planning" | "writing" | "research" | "review" | "casual" | "strategy";

export type ClientSessionMode = OperationalSessionMode | "auto";

/** @deprecated Use OperationalSessionMode for backend effective mode */
export type OrchestratorSessionMode = OperationalSessionMode;

export function getSessionModeInstructions(
  mode?: OperationalSessionMode,
  options?: { clientMode?: ClientSessionMode }
): string {
  const base = getOperationalModeInstructions(mode);
  if (options?.clientMode === "auto" && mode) {
    return `Session routing: AUTO — effective mode this turn is **${mode.toUpperCase()}**. Behave accordingly.\n${base}`;
  }
  return base;
}

function getOperationalModeInstructions(mode?: OperationalSessionMode): string {
  const voice =
    "Speak like a senior content strategist: warm, concise, one question max when asking. Do not auto-draft unless they clearly ask to write.";
  switch (mode) {
    case "writing":
      return `Session mode: WRITING — ${voice} Prioritize drafting, editing, and refining. Confirm soft requests before generating.`;
    case "research":
      return `Session mode: RESEARCH — ${voice} Load the research skill and run evidence-driven research. Present findings in plain language with sources.`;
    case "review":
      return `Session mode: REVIEW — ${voice} Prioritize editorial feedback; mention campaign/strategy fit when relevant.`;
    case "casual":
      return `Session mode: CASUAL — ${voice} Engage naturally. When they share durable facts (audience, tone, goals), prefer update_memory with a brief ack, then one forward nudge.`;
    case "strategy":
      return `Session mode: STRATEGY — ${voice} Focus on WorkspaceStrategy, campaigns, and calendars. Favor strategy.* and campaigns.* tools.`;
    case "planning":
    default:
      return `Session mode: PLANNING — ${voice} Help define strategy, campaigns, and next steps before executing write tools.`;
  }
}

export interface TurnContextInput {
  message: string;
  sessionMode?: OperationalSessionMode;
  selectionContext?: SelectionContextPayload;
  attachments?: Array<{ name: string; url: string; mime_type: string; extracted_text?: string }>;
  knowledgeSummary?: string;
  contextPackBlock?: string;
}

export function buildEnrichedUserMessage(input: TurnContextInput): string {
  const blocks: string[] = [];
  if (input.selectionContext?.blog_id) {
    const refType = input.selectionContext.reference_type ?? "highlight";
    if (refType === "blog") {
      blocks.push(
        `[User is referencing blog post ${input.selectionContext.blog_id} as context for this message. Prefer blogs.get and blogs.update with id "${input.selectionContext.blog_id}" when editing.]`
      );
    } else if (input.selectionContext.text?.trim()) {
      blocks.push(buildHighlightContextBlock(input.selectionContext));
    }
  }
  if (input.attachments?.length) {
    for (const a of input.attachments) {
      const snippet = (a.extracted_text ?? "").slice(0, 2000) || "(binary or no text extracted)";
      blocks.push(`[Attachment: ${a.name} (${a.mime_type})\n${snippet}]`);
    }
  }
  if (input.contextPackBlock?.trim()) {
    blocks.push(`[Workspace context pack]\n${input.contextPackBlock.trim()}`);
  } else if (input.knowledgeSummary?.trim()) {
    blocks.push(`[Connected knowledge sources:\n${input.knowledgeSummary.slice(0, 6000)}]`);
  }
  blocks.push(input.message);
  return blocks.join("\n\n");
}
