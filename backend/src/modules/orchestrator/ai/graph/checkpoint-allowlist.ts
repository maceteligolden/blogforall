/**
 * Fields allowed in LangGraph checkpoints (docs 05 §1).
 * Secrets, raw API keys, full HTML drafts, and full Research Packages are excluded.
 */
export const CHECKPOINT_FIELD_ALLOWLIST = [
  "turn_id",
  "thread_id",
  "workspace_id",
  "user_id",
  "campaign_id",
  "message",
  "current_time_iso",
  "current_date_human",
  "mode",
  "intent",
  "slots",
  "pending_question",
  "conversation_context",
  "workflow_stage",
  "active_skill",
  "skill_args",
  "plan",
  "awaiting_confirmation",
  "optimize_count",
  "retry_count",
  "max_skills_per_turn",
  "skills_run_this_turn",
  "errors",
  "recovery",
  "strategy",
  "research_package_id",
  "research_summary",
  "outline",
  "draft",
  "optimization_report_id",
  "optimization_plan",
  "quality_gate_passed",
  "metadata",
  "publishing",
  "analytics",
  "memory_views",
  "memory_candidates",
  "reply",
  "progress_events",
  "artifacts_for_client",
] as const;

export type CheckpointField = (typeof CHECKPOINT_FIELD_ALLOWLIST)[number];

/** Never persist these keys on checkpoint (load on demand in skills). */
export const CHECKPOINT_DENYLIST = [
  "research_package",
  "raw_llm_prompts",
  "api_keys",
  "secrets",
] as const;

export function stripDisallowedCheckpointFields<T extends Record<string, unknown>>(
  state: T,
): Partial<T> {
  const allow = new Set<string>(CHECKPOINT_FIELD_ALLOWLIST);
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(state)) {
    if (allow.has(key)) {
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
