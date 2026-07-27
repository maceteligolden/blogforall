import { describe, expect, it, jest } from "@jest/globals";
import {
  canOptimizeAgain,
  contentStrategyArtifactSchema,
  MVP_LOCKS,
  researchPackageSchema,
} from "../../../../modules/orchestrator/ai/contracts";
import { ContentOptimizationService } from "../../../../modules/orchestrator/ai/skills/content-optimization/content-optimization.service";
import { mapBlogReviewToOptimizationReport } from "../../../../modules/orchestrator/ai/skills/content-optimization/review-adapter";
import { buildThinOptimizationReport } from "../../../../modules/orchestrator/ai/skills/content-optimization/thin-validators";
import { ContentStrategyService } from "../../../../modules/orchestrator/ai/skills/strategy/content-strategy.service";
import { researchPackageToNotes } from "../../../../modules/orchestrator/ai/skills/writing/package-to-notes";
import { WritingSkillService } from "../../../../modules/orchestrator/ai/skills/writing/writing.service";
import { assertWritingMayProceed, writingToolAllowlist } from "../../../../modules/orchestrator/ai/skills/writing/writing-guards";

function samplePackage() {
  return researchPackageSchema.parse({
    version: 2,
    id: "rp_1",
    workspace_id: "ws_1",
    created_at: "2026-07-27T00:00:00.000Z",
    depth: "lite",
    topic: "AI agents",
    audience: "founders",
    search_intent: "informational",
    research_questions: [{ id: "q1", question: "What are AI agents?", priority: 1 }],
    knowledge_gaps: [],
    definitions: [
      {
        id: "f1",
        kind: "definition",
        text: "An AI agent acts toward goals.",
        source_id: "s1",
        confidence: 0.9,
        freshness: "evergreen",
      },
    ],
    facts: [],
    statistics: [],
    examples: [],
    expert_opinions: [],
    recent_developments: [],
    entities: [],
    relationships: [],
    contradictions: [],
    evidence_graph: { nodes: [], edges: [] },
    sources: [
      {
        id: "s1",
        url: "https://example.com/agents",
        title: "Agents overview",
        snippet: "Overview of agents",
        category: "other",
        quality_score: 0.8,
        retrieved_at: "2026-07-27T00:00:00.000Z",
      },
    ],
    references: [
      { source_id: "s1", url: "https://example.com/agents", title: "Agents overview" },
    ],
    coverage: {
      items: [{ research_question_id: "q1", status: "completed" }],
      coverage_score: 0.7,
      completed_areas: ["definitions"],
      partial_areas: [],
      missing_areas: [],
    },
    confidence_summary: {
      mean_source_quality: 0.8,
      mean_fact_confidence: 0.9,
      contradiction_count: 0,
    },
  });
}

const richDraft = {
  title: "A Practical Guide to AI Agents for Founders",
  content: `<p>${"Intro sentence that hooks the reader with a concrete problem worth solving now. ".repeat(6)}</p>
<h2>What agents are</h2>
<p>${"Body paragraph with enough words to clear the thin-content bar for structural validation in unit tests. ".repeat(16)}</p>
<h2>How to apply them</h2>
<p>${"More practical guidance with examples and clear next steps for implementers who want results. ".repeat(14)}</p>
<p>Try this approach on your next workflow and get started today.</p>`,
  excerpt:
    "Learn how AI agents work and how founders can apply them without inventing unsupported claims.",
  meta_description:
    "A practical founder guide to AI agents: definitions, pitfalls, and a clear next step to try.",
};

describe("T2.5 WritingSkillService", () => {
  it("maps package sources to grounded notes", () => {
    const notes = researchPackageToNotes(samplePackage());
    expect(notes).toHaveLength(1);
    expect(notes[0]!.url).toContain("example.com");
    expect(notes[0]!.snippet).toMatch(/AI agent/i);
  });

  it("rejects draft without package id", () => {
    expect(() => assertWritingMayProceed({})).toThrow(/research_package_id/);
  });

  it("drafts via BlogGraph notes path without search", async () => {
    const blogGraph = {
      draftFromNotes: jest.fn(async () => ({
        title: "T",
        content: "<p>Hi</p>",
        excerpt: "e",
      })),
      outlineFromNotes: jest.fn(),
      regenerateWithFeedback: jest.fn(),
    };
    const writing = new WritingSkillService(blogGraph as any);
    const result = await writing.run({
      action: "draft",
      workspace_id: "ws_1",
      topic: "AI agents",
      research_package_id: "rp_1",
      research_package: samplePackage(),
    });
    expect(result.used_search).toBe(false);
    expect(result.grounded_source_count).toBe(1);
    expect(blogGraph.draftFromNotes).toHaveBeenCalled();
    const notesArg = (blogGraph.draftFromNotes as jest.Mock).mock.calls[0]![2];
    expect(notesArg).toHaveLength(1);
  });

  it("revise uses optimization plan brief", async () => {
    const blogGraph = {
      draftFromNotes: jest.fn(),
      outlineFromNotes: jest.fn(),
      regenerateWithFeedback: jest.fn(async () => ({
        title: "T2",
        content: "<p>Revised</p>",
        excerpt: "e",
      })),
    };
    const writing = new WritingSkillService(blogGraph as any);
    await writing.run({
      action: "revise",
      workspace_id: "ws_1",
      topic: "AI agents",
      research_package_id: "rp_1",
      draft: { title: "T", content: "<p>Old</p>", excerpt: "e" },
      optimization_plan: {
        version: 1,
        critical: [],
        high: [
          {
            id: "h1",
            priority: "High",
            dimension: "seo",
            message: "Improve meta",
          },
        ],
        medium: [],
        low: [],
        writing_brief: "Tighten meta description.",
      },
    });
    const feedback = (blogGraph.regenerateWithFeedback as jest.Mock).mock.calls[0]![0] as {
      feedback: string;
    };
    expect(feedback.feedback).toMatch(/Tighten meta/);
    expect(feedback.feedback).toMatch(/Improve meta/);
  });

  it("strips search tools from writing allowlist", () => {
    expect(writingToolAllowlist(["a", "search.web", "tavily.search"])).toEqual(["a"]);
  });
});

describe("T2.6 ContentOptimizationService", () => {
  const opt = new ContentOptimizationService();

  it("passes gate on a solid thin-validated draft", () => {
    const { report, should_revise } = opt.run({
      draft: richDraft,
      topic: "AI agents",
      research_package_id: "rp_1",
    });
    expect(report.validator_results.map((v) => v.validator_id)).toEqual(
      expect.arrayContaining(["structural", "readability", "seo_thin", "ux_thin"]),
    );
    expect(report.quality.overall).toBeGreaterThanOrEqual(MVP_LOCKS.optimizeOverallMin);
    expect(report.quality_gate_passed).toBe(true);
    expect(should_revise).toBe(false);
  });

  it("fails gate on thin critical content and allows revise loop", () => {
    const { report, should_revise, can_loop_again } = opt.run({
      draft: {
        title: "Short",
        content: "<p>Too thin.</p>",
        excerpt: "x",
      },
      optimize_count: 0,
    });
    expect(report.plan.critical.length).toBeGreaterThan(0);
    expect(report.quality_gate_passed).toBe(false);
    expect(should_revise).toBe(true);
    expect(can_loop_again).toBe(true);
    expect(canOptimizeAgain(2)).toBe(false);
  });

  it("UX thin recommendations do not solely fail the gate", () => {
    const report = buildThinOptimizationReport({
      draft: {
        ...richDraft,
        content: richDraft.content
          .replace(/Try this approach on your next workflow and get started today\./gi, "Quiet closing paragraph.")
          .replace(/get started/gi, "move forward"),
      },
      topic: "AI agents",
    });
    const ux = report.validator_results.find((v) => v.validator_id === "ux_thin");
    expect(ux?.recommendations.length).toBeGreaterThan(0);
    expect(report.plan.critical.length).toBe(0);
    expect(report.quality_gate_passed).toBe(true);
  });

  it("maps legacy blog-review runner into ContentOptimizationReport", () => {
    const mapped = mapBlogReviewToOptimizationReport({
      review: {
        overall_score: 80,
        scores: {
          readability: 80,
          seo: 78,
          grammar: 90,
          structure: 85,
          fact_check: 70,
          style: 80,
          engagement: 75,
        },
        suggestions: [
          {
            type: "seo",
            priority: "important",
            original: "t",
            suggestion: "Add keyword",
            explanation: "Title could include topic",
          },
        ],
        summary: "Solid draft with SEO nits",
      },
      draft_id: "d1",
    });
    expect(mapped.validator_results[0]?.validator_id).toBe("legacy_blog_review");
    expect(mapped.plan.high.length).toBe(1);
  });
});

describe("T2.7 ContentStrategyService", () => {
  it("returns Zod-valid structured strategy without Research/Writing", () => {
    const strategy = new ContentStrategyService();
    const artifact = strategy.propose({
      topic: "AI agents",
      user_notes: "Focus on SMB",
      workspace_hints: {
        target_audience: ["SMB founders"],
        business_goals: ["Thought leadership"],
      },
    });
    expect(contentStrategyArtifactSchema.parse(artifact).funnel_stage).toBe("awareness");
    expect(artifact.keyword_clusters[0]![0]).toBe("AI agents");
    expect(artifact.content_structure.length).toBeGreaterThanOrEqual(2);
  });
});
