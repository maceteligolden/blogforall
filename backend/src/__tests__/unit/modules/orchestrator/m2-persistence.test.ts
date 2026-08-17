import { describe, expect, it, jest } from "@jest/globals";
import { ArtifactStoreService } from "../../../../modules/orchestrator/ai/memory/artifact-store.service";
import { mapGraphToPackage } from "../../../../modules/orchestratorv2/research/research-package.mapper";
import { buildThinOptimizationReport } from "../../../../modules/orchestrator/ai/skills/content-optimization/thin-validators";
import { evaluateStopping } from "../../../../modules/orchestratorv2/research/research.scoring";

describe("T2.8 ArtifactStoreService", () => {
  it("saves and loads packages/reports/memory via repositories", async () => {
    const packages = {
      save: jest.fn(async (pkg: { id: string }) => ({ package_id: pkg.id })),
      findById: jest.fn(async () => null),
      listRecent: jest.fn(async () => []),
    };
    const reports = {
      save: jest.fn(async (_ws: string, report: { id: string }) => ({ report_id: report.id })),
      findById: jest.fn(async () => null),
      findLatestForDraft: jest.fn(async () => null),
    };
    const memoryRecords = {
      upsert: jest.fn(async (r: unknown) => r),
      getByKey: jest.fn(async () => null),
      listByLayer: jest.fn(async () => []),
    };
    const store = new ArtifactStoreService(packages as any, reports as any, memoryRecords as any);

    const pkg = mapGraphToPackage({
      workspace_id: "ws_1",
      question: "AI agents",
      depth: "lite",
      brief: {
        research_question: "AI agents",
        objectives: ["Compare options"],
        constraints: [],
        decision_criteria: ["Reliability"],
        source_strategy: "Primary docs first",
      },
      subquestions: [{ id: "sq_1", question: "What is an agent?", category: "core", covered: true }],
      searches: [],
      documents: [
        {
          id: "src_1",
          url: "https://example.com/a",
          title: "A",
          snippet: "s",
          source: "example.com",
          tier: 2,
          relevance_score: 0.8,
          credibility_score: 0.7,
          quality_score: 0.7,
        },
      ],
      claims: [
        {
          id: "cl_1",
          claim: "Agents can call tools",
          kind: "fact",
          source_ids: ["src_1"],
          supporting_evidence: ["docs"],
          contradicting_evidence: [],
          confidence: 0.8,
          subquestion_ids: ["sq_1"],
          verified: true,
        },
      ],
      findings: [],
      critic: null,
      report_markdown: "## Executive summary\nAgents can call tools.",
      spoken_summary: "Agents can call tools.",
      degraded: false,
    });
    const savedPkg = await store.saveResearchPackage(pkg);
    expect(savedPkg.package_id).toBe(pkg.id);
    expect(packages.save).toHaveBeenCalled();

    const report = buildThinOptimizationReport({
      draft: {
        title: "A Practical Guide to AI Agents for Founders",
        content: `<p>${"Enough body words for structural validation in persistence tests. ".repeat(20)}</p><h2>Section</h2><p>${"More content here for length. ".repeat(20)}</p>`,
        excerpt: "Learn how AI agents work for founders with clear practical next steps today.",
        meta_description: "A practical founder guide to AI agents with definitions and next steps.",
      },
      topic: "AI agents",
    });
    const savedReport = await store.saveOptimizationReport("ws_1", report);
    expect(savedReport.report_id).toBe(report.id);
    expect(reports.save).toHaveBeenCalledWith("ws_1", report, undefined);

    await store.upsertMemoryRecord({
      id: "mr_1",
      workspace_id: "ws_1",
      user_id: "u1",
      layer: "user_preference",
      canonical_key: "tone",
      value: "short",
      metadata: {
        created_at: "2026-07-27T00:00:00.000Z",
        updated_at: "2026-07-27T00:00:00.000Z",
        confidence: 0.9,
        importance: 0.8,
        version: 1,
      },
    });
    expect(memoryRecords.upsert).toHaveBeenCalled();
  });
});

describe("research stopping criteria", () => {
  it("is incomplete when subquestions are uncovered", () => {
    const snapshot = evaluateStopping({
      subquestions: [{ id: "q1", question: "Cost?", category: "cost", covered: false }],
      claims: [],
      documents: [],
      criticScore: 0.9,
      criticThreshold: 0.7,
      sourceQualityThreshold: 0.35,
    });
    expect(snapshot.complete).toBe(false);
    expect(snapshot.allQuestionsCovered).toBe(false);
  });
});
