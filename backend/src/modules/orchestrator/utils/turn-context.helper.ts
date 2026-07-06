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
  switch (mode) {
    case "writing":
      return "Session mode: WRITING — prioritize drafting, editing, and refining blog content. Favor blogs.generateDraft, blogs.update, and blogs.createDraft when appropriate.";
    case "research":
      return "Session mode: RESEARCH — prioritize search.web, blogs.list, blogs.get, and knowledge sources before recommending actions.";
    case "review":
      return "Session mode: REVIEW — prioritize blogs.review and editorial feedback. Surface scores and concrete improvement suggestions.";
    case "casual":
      return "Session mode: CASUAL — keep replies concise and conversational. Ask one purposeful follow-up when workspace facts are missing. When the user shares durable facts (audience, tone, goals, brand voice), prefer update_memory with a brief acknowledgment. End with a natural next question when it moves the conversation forward.";
    case "strategy":
      return "Session mode: STRATEGY — focus on content themes, posting calendar, and campaign planning. Favor strategy.proposeCalendar and campaigns.generateRoadmap.";
    case "planning":
    default:
      return "Session mode: PLANNING — help the user define strategy, campaigns, schedules, and next steps before executing tools.";
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
