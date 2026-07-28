import { describe, expect, it, jest } from "@jest/globals";
import { routeAfterInvoke, routeAfterPlan } from "../../../../../modules/orchestrator/ai/graph/edges";
import { buildOrchestratorGraph, invokeTurn } from "../../../../../modules/orchestrator/ai/graph/orchestrator.graph";
import { planFromState } from "../../../../../modules/orchestrator/ai/graph/plan.policy";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";
import type { ConversationContext } from "../../../../../modules/orchestrator/ai/contracts/conversation-context";
import { SkillRegistry } from "../../../../../modules/orchestrator/ai/skills/registry";

function ctx(partial: Partial<ConversationContext>): ConversationContext {
  return {
    communicative_category: "unknown",
    workflow_intent: "unknown",
    confidence: 0.8,
    action_required: false,
    conversation_mode: "information",
    humor_detected: false,
    tone_preference: "professional",
    urgency: "normal",
    entities: [],
    references_previous_context: false,
    requires_clarification: false,
    suggested_next_action: "clarify",
    response_style: { brevity: "normal", formality: "neutral", initiative: "suggest" },
    slots_patch: {},
    ...partial,
  };
}

describe("T3.1 plan policy + edges", () => {
  it("routes casual to conversation skill", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Hey!",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
    });
    state.conversation_context = ctx({
      communicative_category: "casual",
      workflow_intent: "casual",
      suggested_next_action: "casual_reply",
      conversation_mode: "casual",
    });
    const plan = planFromState(state);
    expect(plan.next).toBe("invoke_skill");
    expect(plan.skill_id).toBe("conversation");
    expect(plan.skill_args?.purpose).toBe("casual");
    expect(routeAfterPlan({ ...state, plan })).toBe("invoke_skill");
  });

  it("routes clarify to conversation skill", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog post.",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
    });
    state.conversation_context = ctx({
      communicative_category: "request_action",
      workflow_intent: "create_content",
      suggested_next_action: "clarify",
      requires_clarification: true,
      clarification_question: "What topic should we write about?",
      action_required: true,
    });
    const plan = planFromState(state);
    expect(plan.next).toBe("invoke_skill");
    expect(plan.skill_id).toBe("conversation");
    expect(plan.skill_args?.purpose).toBe("clarify");
  });

  it("quick_draft sequences research → writing → optimize", () => {
    const base = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog about AI agents",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
      mode: "quick_draft",
    });
    base.conversation_context = ctx({
      communicative_category: "request_action",
      workflow_intent: "create_content",
      suggested_next_action: "start_content_workflow",
      conversation_mode: "creation",
      action_required: true,
      slots_patch: { topic: "AI agents" },
    });

    expect(planFromState(base).skill_id).toBe("research");

    const withPkg = { ...base, research_package_id: "rp_1", slots: { topic: "AI agents" } };
    expect(planFromState(withPkg).skill_id).toBe("writing");

    const withDraft = {
      ...withPkg,
      draft: { title: "T", content: "<p>x</p>" },
    };
    expect(planFromState(withDraft).skill_id).toBe("content_optimization");

    const gated = { ...withDraft, quality_gate_passed: true };
    expect(planFromState(gated).next).toBe("compose");
  });

  it("research intent does not enter create path", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Research competitors",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
    });
    state.conversation_context = ctx({
      communicative_category: "request_action",
      workflow_intent: "research",
      suggested_next_action: "start_content_workflow",
      action_required: true,
    });
    expect(planFromState(state).skill_id).toBe("research");
    expect(planFromState(state).skill_args?.depth).toBe("full");
  });

  it("routeAfterInvoke returns to plan", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "x",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
    });
    expect(routeAfterInvoke(state)).toBe("plan");
  });
});

describe("T3.1 orchestrator graph invokeTurn", () => {
  it("casual turn: load → plan → conversation → compose → persist", async () => {
    const memory = {
      retrieve: jest.fn(async () => ({
        workspace_slice: { brand_voice: "clear" },
        preferences: [],
        knowledge: [],
        learning: [],
        content_intelligence: [],
        prompt_block: "PROMPT",
        token_budget_used: 10,
        profile: "chat_light",
      })),
      rememberAsync: jest.fn(async () => ({ job_id: "j1" })),
    };
    const registry = new SkillRegistry();
    registry.register("conversation", async () => ({
      summary: "Conversation (casual)",
      patch: { reply: "Hey — good to hear from you. What's on your mind?" },
    }));
    const compiled = buildOrchestratorGraph({ memory: memory as any, registry });
    const out = await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Hey!",
      conversation_context: ctx({
        communicative_category: "casual",
        workflow_intent: "casual",
        suggested_next_action: "casual_reply",
        conversation_mode: "casual",
      }),
    });
    expect(out.reply).toMatch(/good to hear|on your mind/i);
    expect(out.skills_run_this_turn).toBe(1);
    expect(memory.retrieve).toHaveBeenCalled();
    expect(out.progress_events.some((e) => e.type === "persist")).toBe(true);
  });

  it("quick_draft runs research → writing → optimize with mocked skills", async () => {
    const memory = {
      retrieve: jest.fn(async () => ({
        workspace_slice: {},
        preferences: [],
        knowledge: [],
        learning: [],
        content_intelligence: [],
        prompt_block: "",
        token_budget_used: 0,
        profile: "chat_light",
      })),
      rememberAsync: jest.fn(async () => ({ job_id: "j1" })),
    };
    const registry = new SkillRegistry();
    registry.register("research", async () => ({
      summary: "researched",
      patch: {
        research_package_id: "rp_1",
        research_summary: {
          topic: "AI agents",
          depth: "lite",
          coverage_score: 0.7,
          source_count: 3,
          contradiction_count: 0,
        },
      },
    }));
    registry.register("writing", async () => ({
      summary: "drafted",
      patch: {
        draft: {
          title: "AI Agents Guide",
          content: "<p>Body</p>",
          excerpt: "Excerpt",
        },
      },
    }));
    registry.register("content_optimization", async () => ({
      summary: "optimized",
      patch: {
        optimization_report_id: "opt_1",
        optimization_plan: {
          version: 1,
          critical: [],
          high: [],
          medium: [],
          low: [],
          writing_brief: "Looks good",
        },
        quality_gate_passed: true,
      },
    }));

    const compiled = buildOrchestratorGraph({ memory: memory as any, registry });
    const out = await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog about AI agents",
      mode: "quick_draft",
      conversation_context: ctx({
        communicative_category: "request_action",
        workflow_intent: "create_content",
        suggested_next_action: "start_content_workflow",
        conversation_mode: "creation",
        action_required: true,
        slots_patch: { topic: "AI agents" },
      }),
    });

    expect(out.skills_run_this_turn).toBe(3);
    expect(out.research_package_id).toBe("rp_1");
    expect(out.draft).toBeTruthy();
    expect(out.quality_gate_passed).toBe(true);
    expect(out.reply).toMatch(/Research|Draft|Optimization/i);
  });
});
