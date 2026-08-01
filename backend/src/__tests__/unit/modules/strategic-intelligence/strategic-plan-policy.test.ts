import { describe, expect, it } from "@jest/globals";
import {
  BUSINESS_KNOWLEDGE_KEYS,
  BUSINESS_KNOWLEDGE_IMPORTANCE,
  BUSINESS_KNOWLEDGE_QUESTIONS,
} from "../../../../modules/strategic-intelligence/constants/business-knowledge.keys";
import { planFromState } from "../../../../modules/orchestrator/ai/graph/plan.policy";
import type { OrchestratorState } from "../../../../modules/orchestrator/ai/graph/state";
import { createInitialOrchestratorState } from "../../../../modules/orchestrator/ai/graph/state";

describe("Business knowledge taxonomy", () => {
  it("defines USP and audience as highest importance", () => {
    expect(BUSINESS_KNOWLEDGE_IMPORTANCE["business.usp"]).toBe(1);
    expect(BUSINESS_KNOWLEDGE_IMPORTANCE["business.audience"]).toBe(1);
    expect(BUSINESS_KNOWLEDGE_KEYS).toContain("business.objections");
    expect(BUSINESS_KNOWLEDGE_QUESTIONS["business.usp"]).toMatch(/unique selling/i);
  });
});

describe("plan policy strategic intelligence hooks", () => {
  function baseState(overrides: Partial<OrchestratorState> = {}): OrchestratorState {
    const initial = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th1",
      workspace_id: "ws1",
      user_id: "u1",
      message: "Write a blog about our product",
      mode: "chat",
      current_time_iso: new Date().toISOString(),
      current_date_human: "Wednesday, July 29, 2026",
    });
    return {
      ...initial,
      conversation_context: {
        communicative_category: "request_action",
        workflow_intent: "create_content",
        confidence: 0.9,
        action_required: true,
        conversation_mode: "creation",
        humor_detected: false,
        tone_preference: "professional",
        entities: [],
        references_previous_context: false,
        requires_clarification: false,
        suggested_next_action: "start_content_workflow",
        response_style: { brevity: "normal", formality: "neutral", initiative: "suggest" },
        communicative_rationale: "test",
        slots_patch: {},
      } as never,
      ...overrides,
    };
  }

  it("asks campaign clarify when metadata needs_campaign_clarify", () => {
    const plan = planFromState(
      baseState({
        metadata: { needs_campaign_clarify: true },
        skills_run_this_turn: 0,
      })
    );
    expect(plan.next).toBe("invoke_skill");
    expect(plan.skill_id).toBe("conversation");
    expect(String(plan.skill_args?.question ?? "")).toMatch(/campaign/i);
  });

  it("does not block quick_draft for campaign clarify", () => {
    const plan = planFromState(
      baseState({
        mode: "quick_draft",
        metadata: { needs_campaign_clarify: true },
        skills_run_this_turn: 0,
      })
    );
    expect(plan.skill_id).toBe("research");
  });
});
