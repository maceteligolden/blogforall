export type OrchestratorSessionMode =
  | "planning"
  | "writing"
  | "research"
  | "review"
  | "casual";

export function getSessionModeInstructions(mode?: OrchestratorSessionMode): string {
  switch (mode) {
    case "writing":
      return "Session mode: WRITING — prioritize drafting, editing, and refining blog content. Favor blogs.generateDraft, blogs.update, and blogs.createDraft when appropriate.";
    case "research":
      return "Session mode: RESEARCH — prioritize gathering information via blogs.list, blogs.get, categories.list, and scheduled tools before recommending actions.";
    case "review":
      return "Session mode: REVIEW — prioritize blogs.review and editorial feedback. Surface scores and concrete improvement suggestions.";
    case "casual":
      return "Session mode: CASUAL — keep replies concise and conversational while still respecting workspace strategy.";
    case "planning":
    default:
      return "Session mode: PLANNING — help the user define strategy, campaigns, schedules, and next steps before executing tools.";
  }
}

export interface TurnContextInput {
  message: string;
  sessionMode?: OrchestratorSessionMode;
  selectionContext?: { blog_id: string; text: string };
  attachments?: Array<{ name: string; url: string; mime_type: string; extracted_text?: string }>;
  knowledgeSummary?: string;
}

export function buildEnrichedUserMessage(input: TurnContextInput): string {
  const blocks: string[] = [];
  if (input.selectionContext?.text) {
    blocks.push(
      `[User highlighted section in blog ${input.selectionContext.blog_id}:\n"${input.selectionContext.text.slice(0, 4000)}"]`
    );
  }
  if (input.attachments?.length) {
    for (const a of input.attachments) {
      const snippet = (a.extracted_text ?? "").slice(0, 2000) || "(binary or no text extracted)";
      blocks.push(`[Attachment: ${a.name} (${a.mime_type})\n${snippet}]`);
    }
  }
  if (input.knowledgeSummary?.trim()) {
    blocks.push(`[Connected knowledge sources:\n${input.knowledgeSummary.slice(0, 6000)}]`);
  }
  blocks.push(input.message);
  return blocks.join("\n\n");
}
