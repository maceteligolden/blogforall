import { describe, expect, it } from "@jest/globals";
import { analyzeConversationDeterministic } from "../../../../modules/orchestrator/ai/conversation-intelligence/pipeline/analyze-deterministic";
import {
  FORMAT_CLARIFY_QUESTION,
  buildGroundedWritingPrompt,
  buildGroundedWritingInstructions,
  parsePostFormat,
  skipsHowToResearch,
  strategyDefaultsForFormat,
} from "../../../../modules/orchestrator/ai/contracts/post-format";
import { draftRoleInstructions, emptyResearchGuidance } from "../../../../modules/blog/ai/post-format-prompt";
import { ContentStrategyService } from "../../../../modules/orchestrator/ai/skills/strategy/content-strategy.service";
import { buildResearchPackageFromNotes } from "../../../../modules/orchestrator/ai/skills/research/build-package";
import { planFromState } from "../../../../modules/orchestrator/ai/graph/plan.policy";
import { createInitialOrchestratorState } from "../../../../modules/orchestrator/ai/graph/state";
import { buildThinOptimizationReport } from "../../../../modules/orchestrator/ai/skills/content-optimization/thin-validators";

const base = {
  workspace_id: "ws_1",
  user_id: "u_1",
  thread_id: "th_1",
};

describe("post_format editor gate (deterministic CI)", () => {
  it("narrative create without post_format → format clarify", () => {
    const ctx = analyzeConversationDeterministic({
      ...base,
      message: "Write a blog post about riding my bike home today with my friend",
      recent_messages: [
        { role: "user", content: "I rode my bike home today. Cars were everywhere." },
        { role: "assistant", content: "That sounds intense — what happened next?" },
      ],
    });
    expect(ctx.requires_clarification).toBe(true);
    expect(ctx.suggested_next_action).toBe("clarify");
    expect(ctx.clarification_question).toBe(FORMAT_CLARIFY_QUESTION);
    expect(ctx.action_required).toBe(false);
  });

  it("reply “personal story” after format question → create with post_format", () => {
    const ctx = analyzeConversationDeterministic({
      ...base,
      message: "personal story",
      recent_messages: [
        { role: "user", content: "I rode my bike home today with my friend." },
        { role: "user", content: "Write a blog post about that bike ride" },
        { role: "assistant", content: FORMAT_CLARIFY_QUESTION },
      ],
    });
    expect(ctx.slots_patch.post_format).toBe("personal_story");
    expect(ctx.workflow_intent).toBe("create_content");
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
    expect(ctx.action_required).toBe(true);
    expect(ctx.requires_clarification).toBe(false);
  });

  it("just write it skips gate and defaults personal_story for narrative", () => {
    const ctx = analyzeConversationDeterministic({
      ...base,
      message: "Write a blog post about my bike ride — just write it",
      recent_messages: [{ role: "user", content: "I rode my bike home today. Cars were everywhere." }],
    });
    expect(ctx.requires_clarification).toBe(false);
    expect(ctx.slots_patch.post_format).toBe("personal_story");
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
  });

  it("domain create (AI agents) does not ask format", () => {
    const ctx = analyzeConversationDeterministic({
      ...base,
      message: "Write a blog post about AI agents.",
    });
    expect(ctx.requires_clarification).toBe(false);
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
    expect(ctx.slots_patch.post_format).toBeUndefined();
  });

  it("plan policy short-circuits to Conversation when format clarify required", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Write a post about my bike ride",
      current_time_iso: "2026-07-28T00:00:00.000Z",
      current_date_human: "Tue",
      mode: "quick_draft",
    });
    state.conversation_context = analyzeConversationDeterministic({
      ...base,
      message: "Write a blog post about riding my bike home today",
      recent_messages: [{ role: "user", content: "I rode my bike home today." }],
    });
    state.slots = { topic: state.conversation_context.slots_patch.topic };
    const plan = planFromState(state);
    expect(plan.next).toBe("invoke_skill");
    expect(plan.skill_id).toBe("conversation");
    expect(plan.skill_args).toMatchObject({ purpose: "clarify" });
  });
});

describe("parsePostFormat", () => {
  it("parses format picks", () => {
    expect(parsePostFormat("personal story")).toBe("personal_story");
    expect(parsePostFormat("engineering reflection")).toBe("engineering_reflection");
    expect(parsePostFormat("productivity article")).toBe("productivity");
    expect(parsePostFormat("LinkedIn post")).toBe("linkedin_post");
  });
});

describe("genre-aware strategy + research", () => {
  it("personal_story strategy omits best practices / practical framework defaults", () => {
    const strategy = new ContentStrategyService();
    const artifact = strategy.propose({
      topic: "bike ride home",
      post_format: "personal_story",
    });
    expect(artifact.content_angle).toMatch(/First-person|lived narrative/i);
    expect(artifact.content_structure.join(" ")).not.toMatch(/Practical steps or framework/i);
    expect(JSON.stringify(artifact.keyword_clusters)).not.toMatch(/best practices/i);
    expect(artifact.cta).toMatch(/No hard CTA/i);
  });

  it("default productivity strategy keeps best practices framing", () => {
    const defaults = strategyDefaultsForFormat("AI agents", "founders", "productivity");
    expect(defaults.content_structure).toContain("Practical steps or framework");
    expect(defaults.keyword_clusters.flat().some((k: string) => /best practices/i.test(k))).toBe(true);
  });

  it("personal_story research package excludes best-practices questions", () => {
    const built = buildResearchPackageFromNotes({
      workspace_id: "ws",
      topic: "bike ride",
      depth: "full",
      notes: [],
      max_sources: 5,
      post_format: "personal_story",
    });
    const questions = built.package.research_questions.map((q: { question: string }) => q.question).join(" ");
    expect(questions).not.toMatch(/best practices/i);
    expect(questions).toMatch(/concrete details/i);
    expect(skipsHowToResearch("personal_story")).toBe(true);
    expect(skipsHowToResearch("linkedin_post")).toBe(true);
    expect(skipsHowToResearch("productivity")).toBe(false);
  });
});

describe("writing grounding prompts", () => {
  it("grounded instructions ban invented metaphors and morals", () => {
    const text = buildGroundedWritingInstructions("personal_story");
    expect(text).toMatch(/metaphors/i);
    expect(text).toMatch(/philosophical lessons/i);
    expect(text).toMatch(/unclear/i);
  });

  it("buildGroundedWritingPrompt includes user words and format", () => {
    const prompt = buildGroundedWritingPrompt({
      topic: "bike ride",
      userNarrative: "I rode home. My friend mentioned rope re barks.",
      format: "personal_story",
    });
    expect(prompt).toMatch(/rope re barks/);
    expect(prompt).toMatch(/personal_story/);
    expect(prompt).toMatch(/Do not invent/);
  });

  it("empty research guidance for personal formats is narrative-only", () => {
    expect(emptyResearchGuidance("personal_story")).toMatch(/ONLY from the USER REQUEST/i);
    expect(emptyResearchGuidance("personal_story")).toMatch(/Do not fill gaps with general knowledge morals/i);
    expect(emptyResearchGuidance("productivity")).toMatch(/Write from general knowledge/i);
    expect(draftRoleInstructions("personal_story")).toMatch(/ghostwriting a first-person/i);
  });
});

describe("soft optimize for personal formats", () => {
  it("does not recommend CTA for personal_story drafts without CTA", () => {
    const report = buildThinOptimizationReport({
      draft: {
        title: "Bike ride",
        content: "<h2>Home</h2><p>I rode through traffic and felt unsure what my friend meant.</p>",
        excerpt: "A ride home",
      },
      topic: "bike ride",
      post_format: "personal_story",
    });
    const msgs = [...report.plan.low, ...report.plan.medium, ...report.plan.high, ...report.plan.critical].map(
      (r) => r.message
    );
    expect(msgs.some((m) => /call-to-action/i.test(m))).toBe(false);
    expect(report.plan.writing_brief).toMatch(/Do not add CTAs/i);
  });
});
