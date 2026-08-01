import { MVP_LOCKS } from "../contracts/mvp-locks";
import { planResultSchema, type PlanResult } from "../contracts/plan-result";
import type { OrchestratorState } from "./state";
import { env } from "../../../../shared/config/env";

/**
 * Deterministic plan policy (M3) — no LLM.
 * Consumes ConversationContext + workflow artifacts; never invents search for Writing.
 * When Strategic Intelligence is enabled (doc 21), content paths resolve campaign context
 * and may clarify affiliation before generation (except quick_draft).
 */
export function planFromState(state: OrchestratorState): PlanResult {
  const ctx = state.conversation_context;
  const skillsLeft = state.max_skills_per_turn - state.skills_run_this_turn;
  const si = env.orchestrator.strategicIntelligenceEnabled;

  if (skillsLeft <= 0) {
    return planResultSchema.parse({
      next: "compose",
      rationale: "max_skills_per_turn reached; composing with current artifacts",
      workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
    });
  }

  if (ctx?.requires_clarification || ctx?.suggested_next_action === "clarify") {
    if (state.reply?.trim()) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "clarify",
        rationale: "Clarification reply ready",
      });
    }
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose: "clarify" },
      workflow_stage: "clarify",
      rationale: "CI requires clarification — Conversation skill asks one question",
    });
  }

  // Strategic Intelligence: high-value knowledge gap before heavy content work (not quick_draft).
  if (
    si &&
    state.mode !== "quick_draft" &&
    (ctx?.workflow_intent === "create_content" || state.mode === "strategist_pipeline") &&
    state.metadata?.strategic_top_gap_question &&
    !state.metadata?.strategic_gap_asked &&
    state.skills_run_this_turn === 0 &&
    !state.draft
  ) {
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: {
        purpose: "clarify",
        strategic: true,
        question: String(state.metadata.strategic_top_gap_question),
      },
      workflow_stage: "clarify",
      rationale: "Strategic Intelligence: ask highest-value knowledge question before content",
    });
  }

  // Strategic Intelligence: unbound content with multiple campaigns → confirm affiliation.
  if (
    si &&
    state.mode !== "quick_draft" &&
    (ctx?.workflow_intent === "create_content" || state.mode === "strategist_pipeline") &&
    !state.campaign_id &&
    state.metadata?.needs_campaign_clarify === true &&
    !state.metadata?.campaign_clarify_asked &&
    state.skills_run_this_turn === 0
  ) {
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: {
        purpose: "clarify",
        strategic: true,
        question:
          "Which campaign should this support — your Default (Evergreen) campaign, an existing campaign, or should we create a new one?",
      },
      workflow_stage: "clarify",
      rationale: "Strategic Intelligence: resolve campaign affiliation before content work",
    });
  }

  if (
    ctx?.suggested_next_action === "casual_reply" ||
    ctx?.workflow_intent === "casual"
  ) {
    if (state.reply?.trim()) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "done",
        rationale: "Casual reply ready",
      });
    }
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose: "casual" },
      workflow_stage: "done",
      rationale: "Casual turn — Conversation skill",
    });
  }

  if (
    (ctx?.suggested_next_action === "explain" || ctx?.workflow_intent === "explain") &&
    !state.research_package_id &&
    !state.draft &&
    !state.strategy
  ) {
    if (state.reply?.trim()) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "done",
        rationale: "Explain reply ready",
      });
    }
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose: "explain" },
      workflow_stage: "done",
      rationale: "Explain / ask_information — Conversation skill",
    });
  }

  if (ctx?.workflow_intent === "research") {
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "full" },
        workflow_stage: "research",
        rationale: "Research-only turn",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Research package ready",
    });
  }

  /**
   * User-directed revise (section rewrite, add/remove section, editorial feedback).
   * Apply user feedback via Writing revise — do not run Content Optimization first.
   */
  const userDirectedRevise =
    ctx?.workflow_intent === "update_content" ||
    (ctx?.suggested_next_action === "revise_current_artifact" &&
      ctx?.workflow_intent !== "optimize_content" &&
      (ctx?.communicative_category === "provide_feedback" ||
        ctx?.conversation_mode === "editing" ||
        ctx?.conversation_mode === "feedback"));

  if (userDirectedRevise) {
    if (!state.draft) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "improve",
        rationale: "Need an open draft before revising from user feedback",
      });
    }
    // One user-feedback revise per turn (writing increments optimize_count).
    if (state.optimize_count === 0) {
      const highlight = state.slots.selection?.highlight?.trim();
      const feedback = [state.message.trim(), highlight ? `Highlighted passage:\n${highlight}` : ""]
        .filter(Boolean)
        .join("\n\n");
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise", feedback },
        workflow_stage: "improve",
        rationale: "Revise open draft from user feedback (section/structural edit)",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "User-directed revise complete — emit updated full draft",
    });
  }

  /** Optimize / review session — ADR-005: content_optimization only (never skill_id review). */
  if (
    ctx?.workflow_intent === "optimize_content" ||
    ctx?.suggested_next_action === "revise_current_artifact"
  ) {
    if (!state.draft) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "optimize",
        rationale: "Need an open draft before Content Optimization",
      });
    }
    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: "Run Content Optimization (replaces Review skill)",
      });
    }
    if (
      state.quality_gate_passed === false &&
      state.optimize_count < MVP_LOCKS.optimizeMaxLoops
    ) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: "Revise from OptimizationPlan",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Optimization path complete",
    });
  }

  if (
    ctx?.workflow_intent === "strategy" ||
    ctx?.suggested_next_action === "start_planning"
  ) {
    if (!state.strategy) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_strategy",
        skill_args: {},
        workflow_stage: "strategy",
        rationale: "Produce Content Strategy artifact",
      });
    }
    // Strategy artifact is internal — Conversation skill turns it into a human reply.
    if (!state.reply?.trim()) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "conversation",
        skill_args: { purpose: "summarize" },
        workflow_stage: "done",
        rationale: "Discuss strategy with user (do not dump raw strategy text)",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Strategy discussion ready",
    });
  }

  // Brainstorm / idea chat without explicit start_planning → converse, don't auto-run strategy.
  if (ctx?.communicative_category === "brainstorm" && !state.reply?.trim()) {
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose: "casual" },
      workflow_stage: "done",
      rationale: "Brainstorm turn — Conversation skill, not Content Strategy dump",
    });
  }

  /** Strategist: strategy → research(full) → outline → write → optimize → improve* */
  if (state.mode === "strategist_pipeline") {
    if (!state.strategy) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_strategy",
        skill_args: {},
        workflow_stage: "strategy",
        rationale: "Strategist pipeline: Content Strategy first",
      });
    }
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "full" },
        workflow_stage: "research",
        rationale: "Strategist pipeline: Research full package",
      });
    }
    if (!state.outline) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "outline" },
        workflow_stage: "outline",
        rationale: "Strategist pipeline: outline before draft",
      });
    }
    if (!state.draft) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "draft" },
        workflow_stage: "write",
        rationale: "Strategist pipeline: draft from Package (no web search)",
      });
    }
    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: "Strategist pipeline: Content Optimization gate",
      });
    }
    if (
      state.quality_gate_passed === false &&
      state.optimize_count < MVP_LOCKS.optimizeMaxLoops
    ) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: "Strategist pipeline: revise from OptimizationPlan",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Strategist pipeline complete; compose summary",
    });
  }

  const createPath =
    state.mode === "quick_draft" || ctx?.workflow_intent === "create_content";

  if (createPath) {
    if (!state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "lite" },
        workflow_stage: "research",
        rationale: "Need Research lite package before Writing",
      });
    }
    if (!state.draft) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "draft" },
        workflow_stage: "write",
        rationale: "Draft from Research Package (no web search)",
      });
    }
    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: "Run Content Optimization gate",
      });
    }
    if (
      state.quality_gate_passed === false &&
      state.optimize_count < MVP_LOCKS.optimizeMaxLoops
    ) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: "Revise from OptimizationPlan (loop)",
      });
    }
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Create path complete; compose summary",
    });
  }

  if (ctx?.suggested_next_action === "emit_memory_candidate") {
    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: "Preference update → memory candidate on persist",
    });
  }

  if (!state.reply?.trim()) {
    const purpose =
      ctx?.suggested_next_action === "explain" || ctx?.workflow_intent === "explain"
        ? "explain"
        : "casual";
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose },
      workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
      rationale: "Open conversational path — Conversation skill",
    });
  }

  return planResultSchema.parse({
    next: "compose",
    workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
    rationale: "Conversational reply ready",
  });
}
