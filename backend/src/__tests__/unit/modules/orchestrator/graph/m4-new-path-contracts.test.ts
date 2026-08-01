import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import { skillIdSchema } from "../../../../../modules/orchestrator/ai/contracts/enums";
import { planFromState } from "../../../../../modules/orchestrator/ai/graph/plan.policy";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";
import {
  isLegacyWriterResearchTool,
  LEGACY_WRITER_RESEARCH_TOOLS,
  WRITING_FORBIDDEN_BLOG_GRAPH_METHODS,
  writingToolAllowlist,
} from "../../../../../modules/orchestrator/ai/skills/writing/writing-guards";

describe("T4.3 / T4.4 new-path contracts", () => {
  it("Writing allowlist excludes search and legacy generateDraft", () => {
    expect(writingToolAllowlist(["blogs.save", "search.web", "tavily.search", "blogs.generateDraft"])).toEqual([
      "blogs.save",
    ]);
    expect(isLegacyWriterResearchTool("blogs.generateDraft")).toBe(true);
    expect([...LEGACY_WRITER_RESEARCH_TOOLS]).toContain("blogs.generateDraft");
  });

  it("Writing skill source never calls BlogGraph generateFull / streamGenerate", () => {
    const src = readFileSync(
      join(__dirname, "../../../../../modules/orchestrator/ai/skills/writing/writing.service.ts"),
      "utf8"
    );
    for (const method of WRITING_FORBIDDEN_BLOG_GRAPH_METHODS) {
      expect(src).not.toMatch(new RegExp(`blogGraph\\.${method}\\b`));
    }
    expect(src).toMatch(/draftFromNotes/);
    expect(src).toMatch(/outlineFromNotes/);
  });

  it("skillIdSchema has content_optimization and not review", () => {
    expect(skillIdSchema.safeParse("content_optimization").success).toBe(true);
    expect(skillIdSchema.safeParse("review").success).toBe(false);
  });

  it("optimize_content intent plans content_optimization never review", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Improve SEO on this draft",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    state.conversation_context = {
      communicative_category: "request_action",
      workflow_intent: "optimize_content",
      confidence: 0.9,
      action_required: true,
      conversation_mode: "creation",
      humor_detected: false,
      tone_preference: "professional",
      urgency: "normal",
      entities: [],
      references_previous_context: false,
      requires_clarification: false,
      suggested_next_action: "revise_current_artifact",
      response_style: { brevity: "normal", formality: "neutral", initiative: "suggest" },
      slots_patch: {},
    };
    state.draft = { title: "T", content: "<p>x</p>" };
    const plan = planFromState(state);
    expect(plan.skill_id).toBe("content_optimization");
    expect(plan.skill_id).not.toBe("review" as never);
  });
});
