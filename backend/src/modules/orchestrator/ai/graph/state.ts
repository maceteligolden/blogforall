import { Annotation } from "@langchain/langgraph";
import type { ConversationContext } from "../contracts/conversation-context";
import type { DialogueSlots } from "../contracts/dialogue-slots";
import type { Intent, SkillId, WorkflowMode, WorkflowStage } from "../contracts/enums";
import type { MemoryCandidate } from "../contracts/memory-record";
import { MVP_LOCKS } from "../contracts/mvp-locks";
import type { OptimizationPlan } from "../contracts/content-optimization";
import type { PlanResult, ConfirmationRequest } from "../contracts/plan-result";
import type { ResearchPackage, ResearchPackageSummary } from "../contracts/research-package";

export type TurnError = {
  code: string;
  message: string;
  skill_id?: SkillId;
  recoverable?: boolean;
};

export type ProgressEvent = {
  type: string;
  message?: string;
  at?: string;
  meta?: Record<string, unknown>;
};

export type ClientArtifactRef = {
  kind: string;
  id: string;
  title?: string;
};

export type RecoveryDecision = {
  action: "retry" | "degrade" | "ask_user" | "abort_stage";
  rationale: string;
};

export type MemoryViews = Record<string, unknown>;

/**
 * LangGraph orchestrator state (docs/architecture/v0.5/05-state-schema.md).
 * Full ResearchPackage bodies are same-turn only — prefer ids in checkpoints.
 */
export const OrchestratorStateAnnotation = Annotation.Root({
  turn_id: Annotation<string>,
  thread_id: Annotation<string>,
  workspace_id: Annotation<string>,
  user_id: Annotation<string>,
  campaign_id: Annotation<string | undefined>,

  message: Annotation<string>,
  current_time_iso: Annotation<string>,
  current_date_human: Annotation<string>,

  mode: Annotation<WorkflowMode>,
  intent: Annotation<Intent | undefined>,
  slots: Annotation<DialogueSlots>,
  pending_question: Annotation<string | undefined>,
  conversation_context: Annotation<ConversationContext | undefined>,

  workflow_stage: Annotation<WorkflowStage>,
  active_skill: Annotation<SkillId | undefined>,
  skill_args: Annotation<Record<string, unknown> | undefined>,
  plan: Annotation<PlanResult | undefined>,
  awaiting_confirmation: Annotation<ConfirmationRequest | undefined>,
  optimize_count: Annotation<number>,
  retry_count: Annotation<number>,
  max_skills_per_turn: Annotation<number>,
  skills_run_this_turn: Annotation<number>,
  errors: Annotation<TurnError[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  recovery: Annotation<RecoveryDecision | undefined>,

  strategy: Annotation<Record<string, unknown> | undefined>,
  research_package_id: Annotation<string | undefined>,
  research_summary: Annotation<ResearchPackageSummary | undefined>,
  research_package: Annotation<ResearchPackage | undefined>,
  outline: Annotation<Record<string, unknown> | undefined>,
  draft: Annotation<Record<string, unknown> | undefined>,
  optimization_report_id: Annotation<string | undefined>,
  optimization_plan: Annotation<OptimizationPlan | undefined>,
  quality_gate_passed: Annotation<boolean | undefined>,
  metadata: Annotation<Record<string, unknown> | undefined>,
  publishing: Annotation<Record<string, unknown> | undefined>,
  analytics: Annotation<Record<string, unknown> | undefined>,

  memory_views: Annotation<MemoryViews | undefined>,
  memory_candidates: Annotation<MemoryCandidate[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),

  reply: Annotation<string | undefined>,
  progress_events: Annotation<ProgressEvent[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  artifacts_for_client: Annotation<ClientArtifactRef[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
});

export type OrchestratorState = typeof OrchestratorStateAnnotation.State;

export function createInitialOrchestratorState(input: {
  turn_id: string;
  thread_id: string;
  workspace_id: string;
  user_id: string;
  message: string;
  current_time_iso: string;
  current_date_human: string;
  mode?: WorkflowMode;
  campaign_id?: string;
}): OrchestratorState {
  return {
    turn_id: input.turn_id,
    thread_id: input.thread_id,
    workspace_id: input.workspace_id,
    user_id: input.user_id,
    campaign_id: input.campaign_id,
    message: input.message,
    current_time_iso: input.current_time_iso,
    current_date_human: input.current_date_human,
    mode: input.mode ?? "chat",
    intent: undefined,
    slots: {},
    pending_question: undefined,
    conversation_context: undefined,
    workflow_stage: "idle",
    active_skill: undefined,
    skill_args: undefined,
    plan: undefined,
    awaiting_confirmation: undefined,
    optimize_count: 0,
    retry_count: 0,
    max_skills_per_turn: MVP_LOCKS.maxSkillsPerTurn,
    skills_run_this_turn: 0,
    errors: [],
    recovery: undefined,
    strategy: undefined,
    research_package_id: undefined,
    research_summary: undefined,
    research_package: undefined,
    outline: undefined,
    draft: undefined,
    optimization_report_id: undefined,
    optimization_plan: undefined,
    quality_gate_passed: undefined,
    metadata: undefined,
    publishing: undefined,
    analytics: undefined,
    memory_views: undefined,
    memory_candidates: [],
    reply: undefined,
    progress_events: [],
    artifacts_for_client: [],
  };
}
