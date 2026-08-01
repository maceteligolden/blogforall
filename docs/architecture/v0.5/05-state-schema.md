# 05 — State Schema

## 1. Principles

1. **Strongly typed** LangGraph `Annotation` + Zod at LLM/tool boundaries.
2. Nodes and skills return **partial patches**, not full state clones.
3. Pass **structured artifacts**, never “next prompt” strings between nodes.
4. Prefer **ids + summaries** in state; load full bodies on demand in skills.
5. Keep secrets/PII out of checkpoints (strip like cognition Redis checkpointer).

---

## 2. OrchestratorState (conceptual TypeScript)

```typescript
/** Top-level LangGraph state — target v0.5 */

export type WorkflowMode =
  | "chat"
  | "quick_draft"
  | "strategist_pipeline"
  | "onboarding";

/**
 * Turn entry also seeds (when present):
 * - recent_messages: last N thread turns for Conversation/Writing grounding
 * - draft + metadata.blog_id + slots.selection: from client selection_context.blog_id
 *   (required for user-directed revise on a fresh turn)
 */

export type WorkflowStage =
  | "idle"
  | "clarify"
  | "strategy"
  | "research"
  | "outline"
  | "write"
  | "optimize"              // was "review" — alias accepted M1–M3
  | "improve"
  | "publish"
  | "done";

export type Intent =
  | "create_content"
  | "update_content"
  | "optimize_content"      // was review_content
  | "review_content"        // legacy alias → optimize_content
  | "publish_content"
  | "schedule_content"
  | "unpublish_content"
  | "delete_content"
  | "list_content"
  | "get_content"
  | "explain"
  | "strategy"
  | "research"
  | "analytics"
  | "update_memory"
  | "onboarding"
  | "casual"
  | "unknown";

export interface OrchestratorState {
  // --- identity ---
  turn_id: string;
  thread_id: string;
  workspace_id: string;
  user_id: string;
  campaign_id?: string;

  // --- input ---
  message: string;
  current_time_iso: string;
  current_date_human: string;

  // --- dialogue ---
  mode: WorkflowMode;
  intent?: Intent; // mirrored from conversation_context.workflow_intent
  slots: DialogueSlots;
  pending_question?: string;
  /** Primary NLU output — from Conversation Intelligence (pre-graph) */
  conversation_context?: ConversationContext;
  /** @deprecated absorbed by ConversationContext — migration shim only */
  understand?: UnderstandResult;

  // --- workflow control ---
  workflow_stage: WorkflowStage;
  active_skill?: SkillId;
  skill_args?: Record<string, unknown>;
  plan?: PlanResult;
  awaiting_confirmation?: ConfirmationRequest;
  /** Optimize→revise loop counter (replaces improve_count for quality gate) */
  optimize_count: number;
  /** @deprecated use optimize_count */
  improve_count?: number;
  retry_count: number;
  /** Default MVP: 5. Chat mode often 1 skill; pipeline may chain up to this cap. */
  max_skills_per_turn: number;
  skills_run_this_turn: number;
  errors: TurnError[];
  recovery?: RecoveryDecision;

  // --- artifacts (structured) ---
  strategy?: ContentStrategyArtifact;
  /** Prefer id + summary; hydrate full package via Content Memory */
  research_package_id?: string;
  research_summary?: ResearchPackageSummary;
  /** Same-turn hydrate only; avoid persisting full package in checkpoint */
  research_package?: ResearchPackage;
  outline?: OutlineArtifact;
  draft?: DraftArtifact;
  /** Content Optimization — prefer id + plan; full report in Content Memory */
  optimization_report_id?: string;
  optimization_plan?: OptimizationPlan;
  quality_gate_passed?: boolean;
  /** @deprecated use optimization_* — alias during migration */
  review?: never;
  metadata?: ContentMetadata;
  publishing?: PublishingArtifact;
  analytics?: AnalyticsArtifact;

  // --- memory views (assembled, budgeted) ---
  memory_views?: MemoryViews;
  /** Candidates for Memory Manager rememberAsync after reply */
  memory_candidates?: MemoryCandidate[];

  // --- output ---
  reply?: string;
  progress_events: ProgressEvent[];
  artifacts_for_client?: ClientArtifactRef[];
}

export type SkillId =
  | "conversation"
  | "content_strategy"
  | "research"
  | "writing"
  | "content_optimization"  // replaces "review"
  | "publishing"
  | "analytics";
  // "review" removed — map legacy to content_optimization
```

---

## 3. Dialogue slots

```typescript
export interface DialogueSlots {
  topic?: string;
  blog_id?: string;
  title_query?: string;
  tone?: string;
  target_audience?: string;
  word_count?: number;
  scheduled_at?: string;
  category_ids?: string[];
  feedback?: string;           // revise / rework notes
  proceed_despite_strategy_warning?: boolean;
  outline_approved?: boolean;
  selection?: {
    blog_id?: string;
    highlight?: string;
  };
}
```

---

## 4. Conversation Intelligence / Plan results

Canonical CI design: [19-conversation-intelligence.md](./19-conversation-intelligence.md).

```typescript
export type CommunicativeCategory =
  | "ask_information"
  | "request_action"
  | "brainstorm"
  | "provide_feedback"
  | "update_preferences"
  | "casual"
  | "unknown";

export type ConversationMode =
  | "information"
  | "creation"
  | "planning"
  | "editing"
  | "feedback"
  | "casual";

export type SuggestedNextAction =
  | "explain"
  | "start_content_workflow"
  | "start_planning"
  | "revise_current_artifact"
  | "emit_memory_candidate"
  | "casual_reply"
  | "clarify";

export interface ConversationEntity {
  type: "topic" | "blog_id" | "url" | "audience" | "channel" | "other";
  value: string;
  confidence: number;
}

export interface ConversationContext {
  communicative_category: CommunicativeCategory;
  workflow_intent: Intent;
  confidence: number;
  action_required: boolean;
  conversation_mode: ConversationMode;
  emotional_state?: string;
  humor_detected: boolean;
  tone_preference: "casual" | "professional" | "technical" | "friendly";
  urgency?: "low" | "normal" | "high";
  entities: ConversationEntity[];
  references_previous_context: boolean;
  requires_clarification: boolean;
  clarification_question?: string;
  suggested_next_action: SuggestedNextAction;
  response_style: {
    brevity: "short" | "normal" | "detailed";
    formality: "casual" | "neutral" | "formal";
    initiative: "passive" | "suggest" | "lead";
  };
  slots_patch: Partial<DialogueSlots>;
  literal_interpretation?: string;
  communicative_rationale?: string;
}

/** @deprecated Use ConversationContext — shim during migration */
export interface UnderstandResult {
  intent: Intent;
  mode: WorkflowMode;
  slots_patch: Partial<DialogueSlots>;
  needs_clarification: boolean;
  clarification_question?: string;
  confidence: number;
  rationale?: string;
}

export interface PlanResult {
  next: "invoke_skill" | "await_human" | "compose" | "end";
  skill_id?: SkillId;
  skill_args?: Record<string, unknown>;
  workflow_stage?: WorkflowStage;
  confirmation?: ConfirmationRequest;
  rationale: string;
}

export interface ConfirmationRequest {
  action: string;
  payload: Record<string, unknown>;
  summary: string;
  kind: "destructive" | "strategy_warning" | "outline_approval" | "ambiguous_target";
}
```

---

## 5. Artifact schemas

### 5.1 Content strategy

```typescript
export interface ContentStrategyArtifact {
  version: 1;
  objective: string;
  audience: {
    primary: string;
    pains?: string[];
    desires?: string[];
  };
  search_intent: "informational" | "commercial" | "transactional" | "navigational";
  keyword_cluster: string[];
  primary_keyword?: string;
  funnel_stage: "awareness" | "consideration" | "decision" | "retention";
  angle: string;
  structure: Array<{ heading: string; purpose: string }>;
  cta: string;
  topical_authority_opportunities: string[];
  risks_or_conflicts?: string[];
  created_at: string;
}
```

### 5.2 Research Package (canonical)

Flat `ResearchArtifact` (snippet lists) is **retired**. The Research Skill emits a **Research Package** with evidence graph and provenance.

Full field definitions live in [16-research-pipeline.md](./16-research-pipeline.md). Orchestrator-facing summary:

```typescript
export interface ResearchPackageSummary {
  topic: string;
  depth: "lite" | "full";
  coverage_score: number;
  source_count: number;
  contradiction_count: number;
  degraded?: boolean;
}

/** See [16-research-pipeline.md](./16-research-pipeline.md) §6 for full ResearchPackage fields. */
export type ResearchPackage = Record<string, unknown> & {
  topic: string;
  depth: "lite" | "full";
  coverage_score: number;
};
```

**Checkpoint rule:** persist `research_package_id` + `research_summary`; load full package in Writing/Content Optimization via Content Memory.

### 5.3 Outline / draft

```typescript
export interface OutlineArtifact {
  version: 1;
  title_options: string[];
  sections: Array<{
    id: string;
    heading: string;
    key_points: string[];
    target_words?: number;
  }>;
  approved?: boolean;
}

export interface DraftArtifact {
  version: 1;
  blog_id?: string;
  title: string;
  content_html: string;
  excerpt: string;
  meta?: { description?: string; keywords?: string[] };
  preview_url?: string;
  revision_of?: string;        // prior draft fingerprint/id
}
```

### 5.4 Content Optimization (replaces Review)

`ReviewArtifact` is **retired**. Canonical models live in [17-content-optimization.md](./17-content-optimization.md):

- `ContentOptimizationReport`, SEO/GAO scorecards, `OptimizationPlan`
- `ValidatorResult`, `OptimizationRecommendation`

Orchestrator holds `optimization_report_id`, `optimization_plan`, `optimize_count`, `quality_gate_passed`.

During M1–M3, adapters may map legacy `blog-review.runner` scores into `ValidatorResult` shapes.

### 5.5 Publishing / analytics / metadata

```typescript
export interface ContentMetadata {
  seo_title?: string;
  meta_description?: string;
  slug?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  twitter_card?: string;
  json_ld?: Record<string, unknown>;
  categories?: string[];
  tags?: string[];
  keywords?: string[];
}

export interface PublishingArtifact {
  status: "draft" | "scheduled" | "published" | "unpublished";
  scheduled_at?: string;
  published_at?: string;
  cms_result?: Record<string, unknown>;
  preview_url?: string;
}

export interface AnalyticsArtifact {
  blog_id?: string;
  metrics: Record<string, number>;
  declining: Array<{ blog_id: string; reason: string }>;
  recommendations: string[];
  as_of: string;
}
```

---

## 6. Memory views and candidates

Produced by `MemoryManager.retrieve` — see [18-memory-manager.md](./18-memory-manager.md).

```typescript
export interface MemoryViews {
  /** Projection of MemoryRetrievalResult for prompts */
  workspace_summary: string;
  session_summary?: string;
  preferences_summary?: string;
  knowledge_snippets?: string[];
  learning_rules?: string[];
  content_intelligence_hints?: string[];
  relevant_content_refs: Array<{ blog_id: string; title: string; reason: string }>;
  token_budget_used: number;
  retrieval_profile: string;
}

/** Emitted for background remember — orchestrator does not persist beliefs itself */
export interface MemoryCandidateState {
  candidates: MemoryCandidate[];  // from 18
}
```

`memory_candidates` are defined on `OrchestratorState` above; persist enqueues them via Memory Manager `rememberAsync`.

---

## 7. Errors and recovery

```typescript
export interface TurnError {
  at: string;                  // node or skill id
  code: string;
  message: string;
  retryable: boolean;
  timestamp: string;
}

export interface RecoveryDecision {
  strategy: "retry" | "degrade" | "ask_user" | "abort_stage";
  message_for_user?: string;
  retry_skill_id?: SkillId;
}
```

---

## 8. LangGraph Annotation notes

- Use reducers for arrays (`errors`, `progress_events`) that **append**.
- Use last-write-wins for artifact objects (`strategy`, `draft`, …).
- `skills_run_this_turn` increments in `invoke_skill`.
- Do not store raw LLM message history in Annotation if it already lives in thread repo — reference `thread_id` only.

---

## 9. Skill result contract

```typescript
export interface SkillResult {
  ok: boolean;
  state_patch: Partial<OrchestratorState>;
  summary_for_composer: string;
  progress_events?: ProgressEvent[];
  needs_confirmation?: ConfirmationRequest;
  error?: TurnError;
}
```

Skills never mutate global stores directly except via tools/ports injected in `SkillContext` (and should prefer returning patches so `persist` remains the write boundary when feasible).

**Pragmatic exception:** Writing/Publishing tools that already persist blogs today may continue to write through domain services; state still receives `draft` / `publishing` patches for the orchestrator.

---

## Next

- Skills: [06-skill-architecture.md](./06-skill-architecture.md)
