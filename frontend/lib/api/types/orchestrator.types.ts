export type OrchestratorApprovalKind =
  | "in_chat_confirmation"
  | "memory_update"
  | "scheduled_post_review"
  | "campaign_proposal"
  | "campaign_roadmap_approval";

export type OrchestratorApprovalStatus = "pending" | "approved" | "rejected" | "executed" | "expired";

export interface OrchestratorApprovalPayload {
  id?: string;
  destinations?: string[];
  available_destinations?: Array<{ provider: string; label: string }>;
  scheduled_at?: string;
}

export interface OrchestratorApproval {
  id: string;
  kind: OrchestratorApprovalKind;
  action: string;
  summary: string;
  status: OrchestratorApprovalStatus;
  requested_at: string;
  payload?: OrchestratorApprovalPayload;
}

export interface OrchestratorThread {
  _id: string;
  site_id: string;
  user_id: string;
  created_by?: string;
  title: string;
  title_source?: "default" | "auto" | "user";
  status: "active" | "archived";
  channel?: "chat" | "call";
  last_activity_at: string;
  is_onboarding: boolean;
  focus?: ThreadFocus;
  associations?: ThreadAssociation[];
  created_at: string;
  updated_at: string;
}

export type ThreadAssociationEntityType = "strategy" | "campaign" | "blog";

export type ThreadAssociation = {
  entity_type: ThreadAssociationEntityType;
  entity_id: string;
};

export type ThreadWriteLock = {
  user_id: string;
  name: string;
  acquired_at?: string;
};

export type ThreadFocus = {
  campaign_id?: string;
  roadmap_sequence_index?: number;
  blog_id?: string;
  topic?: string;
  intent?: string;
};

export type NextDueTopic = {
  campaign_id: string;
  campaign_name: string;
  sequence_index: number;
  title: string;
  objective: string;
  strategic_intent: string;
  scheduled_at?: string;
  overdue: boolean;
};

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

export interface SetupInterviewStartResponse {
  complete: boolean;
  thread_id?: string;
  assistant_message?: {
    id: string;
    content: string;
    created_at: string;
  };
  progress: {
    items: Array<{ id: string; label: string; done: boolean }>;
    percent: number;
    complete: boolean;
  };
}

export type WorkspaceBriefPriority =
  | "onboarding"
  | "approvals"
  | "drafts"
  | "campaign_risk"
  | "strategy_gap"
  | "welcome_back";

export interface OpenThreadResponse {
  thread_id: string;
  assistant_message?: {
    id: string;
    content: string;
    created_at: string;
  };
  chips: string[];
  next_topics?: NextDueTopic[];
  priority: WorkspaceBriefPriority;
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
  active_session_mode: "planning" | "writing" | "research" | "review" | "casual" | "strategy";
  session_mode_source?: "explicit" | "manual" | "inferred";
  workspace_status: "onboarding" | "active";
  onboarding_completed: boolean;
  /** Present when ORCHESTRATOR_V05_GRAPH_ENABLED routed this turn. */
  v05_graph?: {
    enabled: true;
    workflow_stage: string;
    skills_run: number;
    mode: string;
    phases?: Array<{
      phase: string;
      message: string;
      percent?: number;
      skill_id?: string;
      meta?: Record<string, unknown>;
    }>;
    research_summary?: V05ResearchMoatSnapshot;
    optimization?: V05OptimizationMoatSnapshot;
  };
}

export type V05ResearchMoatSnapshot = {
  coverage_score: number;
  source_count: number;
  contradiction_count: number;
  depth?: "lite" | "full";
  degraded?: boolean;
  package_id?: string;
};

export type V05OptimizationMoatSnapshot = {
  overall?: number;
  seo?: number;
  gao?: number;
  quality_gate_passed: boolean;
  critical_count: number;
  report_id?: string;
};

export type V05MoatSnapshot = {
  research_summary?: V05ResearchMoatSnapshot;
  optimization?: V05OptimizationMoatSnapshot;
};

export interface ThreadWithMessages {
  thread: OrchestratorThread;
  messages: OrchestratorMessage[];
  write_lock?: ThreadWriteLock | null;
}

export type ThreadListResponse = {
  threads: OrchestratorThread[];
  next_cursor?: string;
};

export type OrchestratorSessionMode = "auto" | "planning" | "writing" | "research" | "review" | "casual" | "strategy";

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
  conversation_mode?: boolean;
  focus?: ThreadFocus;
  attachments?: OrchestratorChatAttachment[];
  selection_context?: {
    blog_id: string;
    reference_type?: "highlight" | "blog";
    text?: string;
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
