export type OrchestratorApprovalKind =
  | "in_chat_confirmation"
  | "memory_update"
  | "scheduled_post_review"
  | "campaign_proposal";

export type OrchestratorApprovalStatus = "pending" | "approved" | "rejected" | "executed" | "expired";

export interface OrchestratorApproval {
  id: string;
  kind: OrchestratorApprovalKind;
  action: string;
  summary: string;
  status: OrchestratorApprovalStatus;
  requested_at: string;
}

export interface OrchestratorThread {
  _id: string;
  site_id: string;
  user_id: string;
  title: string;
  status: "active" | "archived";
  last_activity_at: string;
  is_onboarding: boolean;
  created_at: string;
  updated_at: string;
}

export type OrchestratorMessageRole = "user" | "assistant" | "tool" | "system";

export interface OrchestratorMessage {
  _id: string;
  thread_id: string;
  site_id: string;
  role: OrchestratorMessageRole;
  content: string;
  tool_calls?: Array<{
    tool: string;
    output_summary?: string;
    output_data?: Record<string, unknown>;
    errored?: boolean;
  }>;
  tool_name?: string;
  pending_approval_id?: string;
  created_at: string;
}

export interface ChatTurnResponse {
  thread_id: string;
  assistant_message: {
    id: string;
    content: string;
    created_at: string;
  };
  tool_calls: Array<{
    tool: string;
    summary: string;
    output_data?: Record<string, unknown>;
  }>;
  pending_approval: OrchestratorApproval | null;
  workspace_status: "onboarding" | "active";
  onboarding_completed: boolean;
}

export interface ThreadWithMessages {
  thread: OrchestratorThread;
  messages: OrchestratorMessage[];
}

export type OrchestratorSessionMode = "planning" | "writing" | "research" | "review" | "casual";

export interface OrchestratorChatAttachment {
  name: string;
  url: string;
  mime_type: string;
  extracted_text?: string;
}

export interface OrchestratorChatRequest {
  message: string;
  thread_id?: string;
  session_mode?: OrchestratorSessionMode;
  attachments?: OrchestratorChatAttachment[];
  selection_context?: {
    blog_id: string;
    text: string;
  };
}

export interface WorkspaceKnowledgeSource {
  _id: string;
  site_id: string;
  provider: "upload" | "google_drive";
  name: string;
  status: "active" | "disconnected";
  file_refs: Array<{
    name: string;
    url: string;
    mime_type: string;
    extracted_text?: string;
  }>;
  created_at: string;
  updated_at: string;
}
