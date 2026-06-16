export type OrchestratorApprovalKind =
  | "in_chat_confirmation"
  | "memory_update"
  | "scheduled_post_review"
  | "campaign_proposal";

export type OrchestratorApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executed"
  | "expired";

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
  tool_calls: Array<{ tool: string; summary: string }>;
  pending_approval: OrchestratorApproval | null;
  workspace_status: "onboarding" | "active";
  onboarding_completed: boolean;
}

export interface ThreadWithMessages {
  thread: OrchestratorThread;
  messages: OrchestratorMessage[];
}
