import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  getCounter,
  getLatencySnapshot,
  resetSkillMetrics,
  skillMetricsSnapshot,
} from "../../../../../modules/orchestrator/ai/observability/skill-metrics";
import { createTurnTracer } from "../../../../../modules/orchestrator/ai/observability/turn-tracer";
import { buildOrchestratorGraph, invokeTurn } from "../../../../../modules/orchestrator/ai/graph/orchestrator.graph";
import { SkillRegistry } from "../../../../../modules/orchestrator/ai/skills/registry";
import type { ConversationContext } from "../../../../../modules/orchestrator/ai/contracts/conversation-context";

function ctx(partial: Partial<ConversationContext>): ConversationContext {
  return {
    communicative_category: "casual",
    workflow_intent: "casual",
    confidence: 0.9,
    action_required: false,
    conversation_mode: "casual",
    humor_detected: false,
    tone_preference: "friendly",
    urgency: "normal",
    entities: [],
    references_previous_context: false,
    requires_clarification: false,
    suggested_next_action: "casual_reply",
    response_style: { brevity: "normal", formality: "casual", initiative: "passive" },
    slots_patch: {},
    ...partial,
  };
}

describe("T3.5 TurnTracer + skill metrics", () => {
  beforeEach(() => {
    resetSkillMetrics();
  });

  it("records nested span tree for a casual turn", async () => {
    const tracer = createTurnTracer({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
    });
    const turn = tracer.startSpan("turn");
    await tracer.timed("ci.analyze", { ci_analyze_id: "ci1" }, async (span) => {
      span.setAttributes({
        communicative_category: "casual",
        workflow_intent: "casual",
        suggested_next_action: "casual_reply",
        confidence: 0.9,
      });
    });

    const memory = {
      retrieve: jest.fn(async () => ({
        workspace_slice: {},
        preferences: [],
        knowledge: [],
        learning: [],
        content_intelligence: [],
        prompt_block: "",
        token_budget_used: 5,
        profile: "chat_light",
      })),
      rememberAsync: jest.fn(async () => ({ job_id: "j1" })),
    };
    const registry = new SkillRegistry();
    registry.register("conversation", async () => ({
      summary: "Conversation (casual)",
      patch: { reply: "Hey — good to hear from you." },
    }));
    const compiled = buildOrchestratorGraph({
      memory: memory as any,
      registry,
      tracer,
    });
    await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Hey!",
      conversation_context: ctx({}),
    });
    turn.end({ status: "ok" });

    const names = tracer.spans.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(["ci.analyze", "memory.retrieve", "plan", "persist", "turn"]),
    );
    expect(tracer.spans.every((s) => s.status === "ok")).toBe(true);
    expect(tracer.spans.find((s) => s.name === "ci.analyze")?.attrs.communicative_category).toBe(
      "casual",
    );
    expect(getLatencySnapshot("plan")?.count).toBeGreaterThanOrEqual(1);
    expect(getCounter("plan.count|ok")).toBeGreaterThanOrEqual(1);
    expect(skillMetricsSnapshot().latencies.plan?.avg_ms).toBeGreaterThanOrEqual(0);
  });

  it("records skill spans on quick_draft path", async () => {
    const tracer = createTurnTracer({ turn_id: "t2", workspace_id: "ws" });
    const registry = new SkillRegistry();
    registry.register("research", async () => ({
      summary: "r",
      patch: {
        research_package_id: "rp",
        research_summary: {
          topic: "t",
          depth: "lite",
          coverage_score: 0.7,
          source_count: 1,
          contradiction_count: 0,
        },
      },
    }));
    registry.register("writing", async () => ({
      summary: "w",
      patch: { draft: { title: "T", content: "<p>x</p>", excerpt: "e" } },
    }));
    registry.register("content_optimization", async () => ({
      summary: "o",
      patch: {
        optimization_report_id: "opt",
        optimization_plan: {
          version: 1,
          critical: [],
          high: [],
          medium: [],
          low: [],
          writing_brief: "ok",
        },
        quality_gate_passed: true,
      },
    }));

    const compiled = buildOrchestratorGraph({
      memory: {
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
        rememberAsync: jest.fn(async () => ({ job_id: "j" })),
      } as any,
      registry,
      tracer,
    });

    await invokeTurn(compiled, {
      turn_id: "t2",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog about AI",
      mode: "quick_draft",
      conversation_context: ctx({
        communicative_category: "request_action",
        workflow_intent: "create_content",
        suggested_next_action: "start_content_workflow",
        conversation_mode: "creation",
        action_required: true,
        slots_patch: { topic: "AI" },
      }),
    });

    const skillSpans = tracer.spans.filter((s) => s.name === "skill");
    expect(skillSpans).toHaveLength(3);
    expect(skillSpans.map((s) => s.attrs.skill_id)).toEqual([
      "research",
      "writing",
      "content_optimization",
    ]);
  });
});
