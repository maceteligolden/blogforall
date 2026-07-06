export type OperationalSessionMode = "planning" | "writing" | "research" | "review" | "casual" | "strategy";

export type OrchestratorSessionMode = OperationalSessionMode | "auto";

export type SelectionReferenceType = "highlight" | "blog";

export interface OrchestratorSelectionContext {
  blogId: string;
  blogTitle: string;
  selectedText?: string;
  referenceType: SelectionReferenceType;
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
