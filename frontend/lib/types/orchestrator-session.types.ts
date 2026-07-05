export type OrchestratorSessionMode =
  | "planning"
  | "writing"
  | "research"
  | "review"
  | "casual";

export interface OrchestratorSelectionContext {
  blogId: string;
  selectedText: string;
  surroundingContext?: string;
}

export interface OrchestratorChatAttachment {
  name: string;
  url: string;
  mime_type: string;
  extracted_text?: string;
}

export interface OrchestratorChatOptions {
  sessionMode?: OrchestratorSessionMode;
  attachments?: OrchestratorChatAttachment[];
  selectionContext?: OrchestratorSelectionContext;
}
