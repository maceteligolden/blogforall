import { MVP_LOCKS } from "../contracts/mvp-locks";
import { planResultSchema, type PlanResult } from "../contracts/plan-result";
import type { OrchestratorState } from "./state";
import { env } from "../../../../shared/config/env";
import {
  isApproveLikeMessage,
  isApproveOutlineMessage,
  isApproveResearchMessage,
  isReviseOutlineMessage,
  isReviseResearchMessage,
  type WritingCheckpoint,
} from "../../utils/writing-hitl.helper";

const USER_ASKED_RESEARCH = /\b(?:research|look\s+(?:it\s+)?up|sources?|fact[\s-]?check)\b/i;

function writingCheckpoint(state: OrchestratorState): WritingCheckpoint | undefined {
  const raw = state.metadata?.writing_checkpoint;
  if (raw === "research" || raw === "outline") return raw;
  return undefined;
}

function researchApproved(state: OrchestratorState): boolean {
  if (state.slots.research_approved === true) return true;
  const checkpoint = writingCheckpoint(state);
  if (checkpoint === "research" && (isApproveResearchMessage(state.message) || isApproveLikeMessage(state.message))) {
    return !isReviseResearchMessage(state.message);
  }
  return false;
}

function outlineApproved(state: OrchestratorState): boolean {
  if (state.slots.outline_approved === true) return true;
  const checkpoint = writingCheckpoint(state);
  if (checkpoint === "outline" && (isApproveOutlineMessage(state.message) || isApproveLikeMessage(state.message))) {
    return !isReviseOutlineMessage(state.message);
  }
  return false;
}

function isCampaignIntent(intent: string | undefined): boolean {
  return (
    intent === "create_campaign" ||
    intent === "update_campaign" ||
    intent === "learn_campaign" ||
    intent === "discuss_campaign" ||
    intent === "campaign_content" ||
    intent === "campaign_performance"
  );
}

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
  const checkpoint = writingCheckpoint(state);

  if (skillsLeft <= 0) {
    return planResultSchema.parse({
      next: "compose",
      rationale: "max_skills_per_turn reached; composing with current artifacts",
      workflow_stage: state.workflow_stage === "idle" ? "done" : state.workflow_stage,
    });
  }

  // Campaign intents: conversational collect — never auto-run Research unless user asks.
  if (isCampaignIntent(ctx?.workflow_intent)) {
    const ranResearch = state.skills_run_this_turn > 0 && Boolean(state.research_package_id);
    if (ranResearch && !USER_ASKED_RESEARCH.test(state.message)) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "done",
        rationale: "Campaign intent: research already ran once — compose/clarify, do not loop research",
      });
    }
    if (USER_ASKED_RESEARCH.test(state.message) && !state.research_package_id) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: { depth: "lite" },
        workflow_stage: "research",
        rationale: "Campaign intent but user explicitly asked for research",
      });
    }
    if (state.reply?.trim()) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "done",
        rationale: "Campaign conversational reply ready",
      });
    }
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: {
        purpose: "clarify",
        campaign_collect: true,
        campaign_intent: ctx?.workflow_intent,
      },
      workflow_stage: "clarify",
      rationale: "Campaign intent — Conversation skill collects fields (no research)",
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
    !state.draft &&
    !checkpoint
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
    state.skills_run_this_turn === 0 &&
    !checkpoint
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

  if (ctx?.suggested_next_action === "casual_reply" || ctx?.workflow_intent === "casual") {
    // Don't treat HITL approve/continue as casual when a writing checkpoint is open.
    if (!checkpoint) {
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
  }

  if (
    (ctx?.suggested_next_action === "explain" || ctx?.workflow_intent === "explain") &&
    !state.research_package_id &&
    !state.draft &&
    !state.strategy &&
    !checkpoint
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

  if (userDirectedRevise && !checkpoint) {
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
    (ctx?.workflow_intent === "optimize_content" || ctx?.suggested_next_action === "revise_current_artifact") &&
    !checkpoint
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
    if (state.quality_gate_passed === false && state.optimize_count < MVP_LOCKS.optimizeMaxLoops) {
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

  if (ctx?.workflow_intent === "strategy" || ctx?.suggested_next_action === "start_planning") {
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
  if (ctx?.communicative_category === "brainstorm" && !state.reply?.trim() && !checkpoint) {
    return planResultSchema.parse({
      next: "invoke_skill",
      skill_id: "conversation",
      skill_args: { purpose: "casual" },
      workflow_stage: "done",
      rationale: "Brainstorm turn — Conversation skill, not Content Strategy dump",
    });
  }

  /** Shared writing HITL steps for strategist + quick_draft create paths. */
  const planWritingPipeline = (opts: {
    needStrategy: boolean;
    researchDepth: "lite" | "full";
    label: string;
  }): PlanResult => {
    if (opts.needStrategy && !state.strategy) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_strategy",
        skill_args: {},
        workflow_stage: "strategy",
        rationale: `${opts.label}: Content Strategy first`,
      });
    }

    // Revise research only once per turn (message stays "Revise the research" after skill runs).
    const reviseResearchOnce = isReviseResearchMessage(state.message) && state.skills_run_this_turn === 0;

    if (!state.research_package_id || reviseResearchOnce) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "research",
        skill_args: {
          depth: opts.researchDepth,
          ...(reviseResearchOnce ? { revise: true } : {}),
        },
        workflow_stage: "research",
        rationale: reviseResearchOnce
          ? `${opts.label}: revise research`
          : `${opts.label}: Research ${opts.researchDepth} package`,
      });
    }

    const reviseOutlineOnce = isReviseOutlineMessage(state.message) && state.skills_run_this_turn === 0;
    if (!state.outline || reviseOutlineOnce) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: {
          action: "outline",
          ...(reviseOutlineOnce ? { revise: true } : {}),
        },
        workflow_stage: "outline",
        rationale: reviseOutlineOnce ? `${opts.label}: modify outline` : `${opts.label}: outline before draft`,
      });
    }

    // HITL pause after outline (before draft).
    if (!state.draft && !outlineApproved(state)) {
      return planResultSchema.parse({
        next: "compose",
        workflow_stage: "outline",
        rationale: `${opts.label}: HITL pause — await outline approval`,
        confirmation: {
          action: "writing_outline",
          payload: { research_package_id: state.research_package_id },
          summary: "Outline is ready — review the structure below.",
          kind: "outline_approval",
        },
      });
    }

    if (!state.draft) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "draft" },
        workflow_stage: "write",
        rationale: `${opts.label}: draft from Package (no web search)`,
      });
    }

    if (state.quality_gate_passed === undefined) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "content_optimization",
        skill_args: {},
        workflow_stage: "optimize",
        rationale: `${opts.label}: Content Optimization gate`,
      });
    }

    if (state.quality_gate_passed === false && state.optimize_count < MVP_LOCKS.optimizeMaxLoops) {
      return planResultSchema.parse({
        next: "invoke_skill",
        skill_id: "writing",
        skill_args: { action: "revise" },
        workflow_stage: "improve",
        rationale: `${opts.label}: revise from OptimizationPlan`,
      });
    }

    return planResultSchema.parse({
      next: "compose",
      workflow_stage: "done",
      rationale: `${opts.label} complete; compose summary`,
    });
  };

  /** Strategist: strategy → research(full) → outline HITL → write → optimize → improve* */
  if (state.mode === "strategist_pipeline") {
    return planWritingPipeline({
      needStrategy: true,
      researchDepth: "full",
      label: "Strategist pipeline",
    });
  }

  // Soft create / clarify-before-write is handled by the clarify branch above
  // (`requires_clarification` or `suggested_next_action === "clarify"`).

  const createPath =
    state.mode === "quick_draft" ||
    (ctx?.workflow_intent === "create_content" && ctx.suggested_next_action === "start_content_workflow") ||
    Boolean(
      checkpoint &&
      (researchApproved(state) ||
        outlineApproved(state) ||
        isReviseResearchMessage(state.message) ||
        isReviseOutlineMessage(state.message))
    );

  if (createPath) {
    return planWritingPipeline({
      needStrategy: false,
      researchDepth: "lite",
      label: "Create path",
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
      ctx?.suggested_next_action === "explain" || ctx?.workflow_intent === "explain" ? "explain" : "casual";
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
