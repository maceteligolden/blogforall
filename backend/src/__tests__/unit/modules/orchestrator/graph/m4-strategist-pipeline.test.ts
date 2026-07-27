import { describe, expect, it, jest } from "@jest/globals";
import { MVP_LOCKS } from "../../../../../modules/orchestrator/ai/contracts";
import { ConversationIntelligenceService } from "../../../../../modules/orchestrator/ai/conversation-intelligence/conversation-intelligence";
import { buildOrchestratorGraph, invokeTurn } from "../../../../../modules/orchestrator/ai/graph/orchestrator.graph";
import { planFromState } from "../../../../../modules/orchestrator/ai/graph/plan.policy";
import { resolveWorkflowMode } from "../../../../../modules/orchestrator/ai/graph/resolve-mode";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";
import type { WorkflowPhaseEvent } from "../../../../../modules/orchestrator/ai/observability/phase-emitter";
import { SkillRegistry } from "../../../../../modules/orchestrator/ai/skills/registry";

/**
 * T4.1 — strategist_pipeline: strategy → research(full) → outline → draft → optimize
 * with streamed coarse phases (research_* / optimize_*).
 */
describe("T4.1 strategist_pipeline staging path", () => {
  const ci = new ConversationIntelligenceService();

  it("resolves high-quality / SEO create language to strategist_pipeline", async () => {
    const message = "Write a high-quality authority post about remote team culture";
    const ctx = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message,
    });
    expect(ctx.workflow_intent).toBe("create_content");

    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message,
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    state.conversation_context = ctx;
    expect(resolveWorkflowMode(state)).toBe("strategist_pipeline");

    const seoCreate = createInitialOrchestratorState({
      turn_id: "t2",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write an SEO-optimized blog about pricing pages",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    seoCreate.conversation_context = {
      ...ctx,
      workflow_intent: "create_content",
      slots_patch: { topic: "pricing pages" },
    };
    expect(resolveWorkflowMode(seoCreate)).toBe("strategist_pipeline");
  });

  it("plan sequences strategy → research full → outline → draft → optimize", () => {
    const base = createInitialOrchestratorState({
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a high-quality post about AI agents",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Monday",
      mode: "strategist_pipeline",
    });
    base.conversation_context = {
      communicative_category: "request_action",
      workflow_intent: "create_content",
      confidence: 0.9,
      action_required: true,
      conversation_mode: "creation",
      humor_detected: false,
      tone_preference: "professional",
      urgency: "normal",
      entities: [],
      references_previous_context: false,
      requires_clarification: false,
      suggested_next_action: "start_content_workflow",
      response_style: { brevity: "normal", formality: "neutral", initiative: "suggest" },
      slots_patch: { topic: "AI agents" },
    };
    base.slots = { topic: "AI agents" };

    expect(planFromState(base).skill_id).toBe("content_strategy");

    const withStrategy = {
      ...base,
      strategy: { id: "s1", content_angle: "operators" },
    };
    expect(planFromState(withStrategy).skill_id).toBe("research");
    expect(planFromState(withStrategy).skill_args?.depth).toBe("full");

    const withPkg = { ...withStrategy, research_package_id: "rp_1" };
    expect(planFromState(withPkg).skill_id).toBe("writing");
    expect(planFromState(withPkg).skill_args?.action).toBe("outline");

    const withOutline = {
      ...withPkg,
      outline: { title: "AI Agents", sections: [{ heading: "Intro", summary: "…" }] },
    };
    expect(planFromState(withOutline).skill_id).toBe("writing");
    expect(planFromState(withOutline).skill_args?.action).toBe("draft");

    const withDraft = {
      ...withOutline,
      draft: { title: "T", content: "<p>x</p>" },
    };
    expect(planFromState(withDraft).skill_id).toBe("content_optimization");

    const gated = { ...withDraft, quality_gate_passed: true };
    expect(planFromState(gated).next).toBe("compose");
  });

  it("e2e strategist path streams research_* and optimize_* phases", async () => {
    const phases: WorkflowPhaseEvent[] = [];
    const retrieve = jest.fn(async () => ({
      workspace_slice: { brand_voice: "clear" },
      preferences: [],
      knowledge: [],
      learning: [],
      content_intelligence: [],
      prompt_block: "PACK",
      token_budget_used: 10,
      profile: "chat_light",
    }));
    const rememberAsync = jest.fn(async () => ({ job_id: "job_1" }));

    const skillOrder: string[] = [];
    const registry = new SkillRegistry();
    registry.register("content_strategy", async () => {
      skillOrder.push("content_strategy");
      return {
        summary: "Strategy: operator lens",
        patch: { strategy: { id: "s1", content_angle: "operator lens", topic: "remote culture" } },
      };
    });
    registry.register("research", async (_s, args) => {
      skillOrder.push("research");
      expect(args.depth).toBe("full");
      return {
        summary: "Research full: 8 sources",
        patch: {
          research_package_id: "rp_st",
          research_summary: {
            topic: "remote culture",
            depth: "full" as const,
            coverage_score: 0.72,
            source_count: 8,
            contradiction_count: 1,
          },
        },
      };
    });    registry.register("writing", async (state, args) => {
      skillOrder.push(`writing:${String(args.action)}`);
      if (args.action === "outline") {
        expect(state.research_package_id).toBe("rp_st");
        expect(state.strategy).toBeTruthy();
        return {
          summary: "Writing outline",
          patch: {
            outline: {
              title: "Remote Culture",
              sections: [
                { heading: "Why culture travels", summary: "…" },
                { heading: "Rituals that scale", summary: "…" },
              ],
            },
          },
        };
      }
      expect(state.outline).toBeTruthy();
      return {
        summary: "Writing draft",
        patch: {
          draft: {
            title: "Remote Culture That Scales",
            content: "<p>Body</p>",
            excerpt: "How remote teams keep culture",
          },
        },
      };
    });
    registry.register("content_optimization", async () => {
      skillOrder.push("content_optimization");
      return {
        summary: "Optimize gate passed (78)",
        patch: {
          optimization_report_id: "opt_st",
          optimization_plan: {
            version: 1,
            critical: [],
            high: [],
            medium: [],
            low: [],
            writing_brief: "Ship with light SEO polish",
          },
          quality_gate_passed: true,
        },
      };
    });

    const onPhase = (e: WorkflowPhaseEvent) => {
      phases.push(e);
    };

    const compiled = buildOrchestratorGraph({
      memory: { retrieve, rememberAsync } as any,
      registry,
      onPhase: (e) => {
        onPhase(e);
        if (e.skill_id === "research" && e.meta?.status === "ok") {
          phases.push(
            {
              phase: "research_planning",
              message: "Planning queries",
              skill_id: "research",
              percent: 10,
            },
            {
              phase: "research_gathering",
              message: "Gathering sources",
              skill_id: "research",
              percent: 35,
            },
            {
              phase: "research_structuring",
              message: "Structuring package",
              skill_id: "research",
              percent: 65,
            },
            {
              phase: "research_packaging",
              message: "Package ready",
              skill_id: "research",
              percent: 95,
              meta: { coverage_score: 0.72, contradiction_count: 1 },
            },
          );
        }
        if (e.skill_id === "content_optimization" && e.message?.startsWith("Starting")) {
          phases.push({
            phase: "optimize_scoring",
            message: "Running SEO / GAO validators",
            skill_id: "content_optimization",
            percent: 40,
          });
        }
        if (e.skill_id === "content_optimization" && e.meta?.status === "ok") {
          phases.push({
            phase: "optimize_gate",
            message: "Gate passed (overall 78)",
            skill_id: "content_optimization",
            percent: 90,
            meta: { overall: 78, seo: 80, gao: 76, quality_gate_passed: true },
          });
        }
      },
    });

    const ctx = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: "Write a high-quality authority post about remote team culture",
    });

    const out = await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a high-quality authority post about remote team culture",
      conversation_context: ctx,
      mode: "chat",
    });

    expect(out.mode).toBe("strategist_pipeline");
    expect(skillOrder).toEqual([
      "content_strategy",
      "research",
      "writing:outline",
      "writing:draft",
      "content_optimization",
    ]);
    expect(out.skills_run_this_turn).toBe(5);
    expect(out.skills_run_this_turn).toBeLessThanOrEqual(MVP_LOCKS.maxSkillsPerTurn);
    expect(out.strategy).toBeTruthy();
    expect(out.research_package_id).toBe("rp_st");
    expect(out.outline).toBeTruthy();
    expect(out.draft).toBeTruthy();
    expect(out.quality_gate_passed).toBe(true);
    expect(out.reply).toMatch(/coverage|Outline|Optimization/i);

    const phaseNames = phases.map((p) => p.phase);
    expect(phaseNames).toEqual(
      expect.arrayContaining([
        "strategy",
        "research",
        "research_planning",
        "research_gathering",
        "research_structuring",
        "research_packaging",
        "outline",
        "draft",
        "optimize",
        "optimize_scoring",
        "optimize_gate",
      ]),
    );
  });
});
