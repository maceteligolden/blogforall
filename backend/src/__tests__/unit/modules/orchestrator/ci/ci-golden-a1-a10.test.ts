import { describe, expect, it } from "@jest/globals";
import { ConversationIntelligenceService } from "../../../../../modules/orchestrator/ai/conversation-intelligence/conversation-intelligence";
import { planFromState } from "../../../../../modules/orchestrator/ai/graph/plan.policy";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";

const base = {
  workspace_id: "ws_1",
  user_id: "u_1",
  thread_id: "th_1",
};

/**
 * PRD_CONVERSATION_INTELLIGENCE acceptance A1–A10 (+ plan coupling for A1).
 */
describe("T3.4 CI golden utterances A1–A10", () => {
  const ci = new ConversationIntelligenceService();

  it("A1 create blog → action_required + create path (not passive)", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "Write a blog post about AI agents.",
    });
    expect(ctx.action_required).toBe(true);
    expect(ctx.workflow_intent).toBe("create_content");
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
    expect(ctx.slots_patch.topic).toMatch(/AI agents/i);

    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog post about AI agents.",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
      mode: "quick_draft",
    });
    state.conversation_context = ctx;
    state.slots = { topic: ctx.slots_patch.topic };
    expect(planFromState(state).next).toBe("invoke_skill");
    expect(planFromState(state).skill_id).toBe("research");
  });

  it("A2 SEO question → explain; no create", async () => {
    const ctx = await ci.analyze({ ...base, message: "How does SEO work?" });
    expect(ctx.workflow_intent).toBe("explain");
    expect(ctx.suggested_next_action).toBe("explain");
    expect(ctx.action_required).toBe(false);
  });

  it("A3 vague write something → brainstorm/planning", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "I want to write something about AI.",
    });
    expect(ctx.communicative_category).toBe("brainstorm");
    expect(ctx.suggested_next_action).toBe("start_planning");
    expect(ctx.workflow_intent).not.toBe("create_content");
  });

  it("A4 feedback with open draft → revise", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "This introduction feels boring.",
      open_artifacts: { draft_id: "d1" },
    });
    expect(ctx.communicative_category).toBe("provide_feedback");
    expect(ctx.suggested_next_action).toBe("revise_current_artifact");
  });

  it("A5 preference → memory candidate; no create", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "I prefer shorter articles.",
    });
    expect(ctx.suggested_next_action).toBe("emit_memory_candidate");
    expect(ctx.workflow_intent).toBe("update_memory");
  });

  it("A6 greeting → casual; no workflow", async () => {
    const ctx = await ci.analyze({ ...base, message: "Hey!" });
    expect(ctx.communicative_category).toBe("casual");
    expect(ctx.suggested_next_action).toBe("casual_reply");
  });

  it("A7 soft suggestion → create_content action (not idle)", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "We should probably write about remote onboarding.",
    });
    expect(ctx.workflow_intent).toBe("create_content");
    expect(ctx.action_required).toBe(true);
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
  });

  it("A8 urgency cues raise urgency and shorten style", async () => {
    const ctx = await ci.analyze({
      ...base,
      message: "Write a blog about payroll — client presentation tomorrow.",
    });
    expect(ctx.urgency).toBe("high");
    expect(ctx.response_style.brevity).toBe("short");
    expect(ctx.workflow_intent).toBe("create_content");
  });

  it("A9 CI service has no skill/tool side effects (pure analyze)", async () => {
    const before = Object.getOwnPropertyNames(ConversationIntelligenceService.prototype);
    expect(before).toContain("analyze");
    expect(before).not.toContain("run");
    const ctx = await ci.analyze({ ...base, message: "Thanks!" });
    expect(ctx.suggested_next_action).toBe("casual_reply");
  });

  it("A10 clarification only when topic missing", async () => {
    const missing = await ci.analyze({ ...base, message: "Write a blog post." });
    expect(missing.requires_clarification).toBe(true);
    expect(missing.suggested_next_action).toBe("clarify");

    const present = await ci.analyze({
      ...base,
      message: "Write a blog post about AI agents.",
    });
    expect(present.requires_clarification).toBe(false);
    expect(present.suggested_next_action).toBe("start_content_workflow");
  });
});
