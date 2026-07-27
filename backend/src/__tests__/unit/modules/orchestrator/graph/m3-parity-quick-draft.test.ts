import { describe, expect, it, jest } from "@jest/globals";
import { MVP_LOCKS } from "../../../../../modules/orchestrator/ai/contracts";
import { ConversationIntelligenceService } from "../../../../../modules/orchestrator/ai/conversation-intelligence/conversation-intelligence";
import { buildOrchestratorGraph, invokeTurn } from "../../../../../modules/orchestrator/ai/graph/orchestrator.graph";
import { resolveWorkflowMode } from "../../../../../modules/orchestrator/ai/graph/resolve-mode";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";
import { needsCoverageRetry } from "../../../../../modules/orchestrator/ai/contracts/research-package";
import { SkillRegistry } from "../../../../../modules/orchestrator/ai/skills/registry";
import { WRITING_FORBIDDEN_TOOLS, writingToolAllowlist } from "../../../../../modules/orchestrator/ai/skills/writing/writing-guards";

/**
 * Doc 14 §7 parity checklist + quick_draft e2e behind graph flag (mocked skills).
 */
describe("T3.3 quick_draft e2e + M3 parity checklist", () => {
  const ci = new ConversationIntelligenceService();

  it("resolves quick draft / urgency to quick_draft mode", async () => {
    const ctx = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: "Quick draft: 5 tips for founders hiring remotely",
    });
    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Quick draft: 5 tips for founders hiring remotely",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    state.conversation_context = ctx;
    expect(resolveWorkflowMode(state)).toBe("quick_draft");

    const urgent = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a blog about AI — need it tomorrow",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    urgent.conversation_context = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: urgent.message,
    });
    expect(resolveWorkflowMode(urgent)).toBe("quick_draft");
  });

  it("quick_draft path: research lite → writing → optimize; retrieve once; no writer search", async () => {
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
    const rememberAsync = jest.fn(async () => {
      await new Promise((r) => setImmediate(r));
      return { job_id: "job_1" };
    });
    let writingSawSearch = false;

    const registry = new SkillRegistry();
    registry.register("research", async (_s, args) => {
      expect(args.depth).toBe("lite");
      return {
        summary: "lite research",
        patch: {
          research_package_id: "rp_qd",
          research_summary: {
            topic: "remote hiring",
            depth: "lite",
            coverage_score: 0.7,
            source_count: 3,
            contradiction_count: 0,
          },
        },
      };
    });
    registry.register("writing", async (state, args) => {
      expect(state.research_package_id).toBe("rp_qd");
      expect(args.action).toBe("draft");
      writingSawSearch = writingToolAllowlist([...WRITING_FORBIDDEN_TOOLS, "blog.save"]).includes(
        "search.web",
      );
      return {
        summary: "drafted without search",
        patch: {
          draft: {
            title: "5 Tips for Remote Hiring",
            content: "<p>Tips</p>",
            excerpt: "Tips for founders",
          },
        },
      };
    });
    registry.register("content_optimization", async () => ({
      summary: "gate passed",
      patch: {
        optimization_report_id: "opt_qd",
        optimization_plan: {
          version: 1,
          critical: [],
          high: [],
          medium: [],
          low: [],
          writing_brief: "Ship it",
        },
        quality_gate_passed: true,
      },
    }));

    const compiled = buildOrchestratorGraph({
      memory: { retrieve, rememberAsync } as any,
      registry,
    });

    const ctx = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: "Quick draft: 5 tips for founders hiring remotely",
    });
    expect(ctx.action_required).toBe(true);
    expect(ctx.workflow_intent).toBe("create_content");

    const out = await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Quick draft: 5 tips for founders hiring remotely",
      conversation_context: ctx,
      mode: "chat",
    });

    expect(out.mode).toBe("quick_draft");
    expect(out.skills_run_this_turn).toBeLessThanOrEqual(MVP_LOCKS.maxSkillsPerTurn);
    expect(out.skills_run_this_turn).toBe(3);
    expect(out.research_package_id).toBe("rp_qd");
    expect(out.draft).toBeTruthy();
    expect(out.quality_gate_passed).toBe(true);
    expect(out.reply).toBeTruthy();
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(writingSawSearch).toBe(false);
    expect(out.progress_events.some((e) => e.type === "persist")).toBe(true);
  });

  it("parity: research coverage retry policy + writing forbid search tools", () => {
    expect(needsCoverageRetry("full", 0.4, 0, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(
      true,
    );
    expect(needsCoverageRetry("full", 0.4, 1, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(
      false,
    );
    expect(needsCoverageRetry("lite", 0.1, 0, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(
      false,
    );
    expect(writingToolAllowlist(["search.web", "tavily.search", "blogs.save"])).toEqual(["blogs.save"]);
  });

  it("parity: rememberAsync returns job_id without waiting on background work", async () => {
    let backgroundDone = false;
    const rememberAsync = jest.fn(async () => {
      void (async () => {
        await new Promise((r) => setTimeout(r, 80));
        backgroundDone = true;
      })();
      return { job_id: "job_fast" };
    });
    const retrieve = jest.fn(async () => ({
      workspace_slice: {},
      preferences: [],
      knowledge: [],
      learning: [],
      content_intelligence: [],
      prompt_block: "",
      token_budget_used: 0,
      profile: "chat_light",
    }));
    const compiled = buildOrchestratorGraph({
      memory: { retrieve, rememberAsync } as any,
      registry: new SkillRegistry(),
    });
    const ctx = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: "I prefer shorter articles.",
    });
    const started = Date.now();
    const out = await invokeTurn(compiled, {
      turn_id: "t1",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "I prefer shorter articles.",
      conversation_context: ctx,
    });
    expect(Date.now() - started).toBeLessThan(80);
    expect(out.reply).toMatch(/remember/i);
    expect(rememberAsync).toHaveBeenCalled();
    expect(backgroundDone).toBe(false);
  });
});
