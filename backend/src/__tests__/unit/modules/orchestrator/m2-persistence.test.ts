import { describe, expect, it, jest } from "@jest/globals";
import { MVP_LOCKS } from "../../../../modules/orchestrator/ai/contracts";
import { ArtifactStoreService } from "../../../../modules/orchestrator/ai/memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "../../../../modules/orchestrator/ai/skills/research/build-package";
import { ResearchFullService } from "../../../../modules/orchestrator/ai/skills/research/research-full.service";
import { ResearchSkillService } from "../../../../modules/orchestrator/ai/skills/research/research-skill.service";
import { buildThinOptimizationReport } from "../../../../modules/orchestrator/ai/skills/content-optimization/thin-validators";

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

    const built = buildResearchPackageFromNotes({
      workspace_id: "ws_1",
      topic: "AI agents",
      depth: "lite",
      notes: [{ url: "https://example.com/a", title: "A", snippet: "s" }],
      max_sources: 5,
    });
    const savedPkg = await store.saveResearchPackage(built.package);
    expect(savedPkg.package_id).toBe(built.package.id);
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

describe("T2.4 ResearchFullService", () => {
  it("uses multi-query search, caps at full max, and can persist", async () => {
    const notes = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/f${i}`,
      title: `Full ${i}`,
      snippet: `Fact ${i}`,
    }));
    const tavily = {
      search: jest.fn(async (q: string) => notes.map((n, i) => ({ ...n, url: `${n.url}-${q.slice(0, 8)}-${i}` }))),
      extract: jest.fn(async (urls: string[]) =>
        urls.map((url) => ({ url, title: "Extracted", text: "Extracted body with concrete steps and pitfalls." }))
      ),
    };
    const artifacts = {
      saveResearchPackage: jest.fn(async (pkg: { id: string }) => ({ package_id: pkg.id })),
    };
    const full = new ResearchFullService(tavily as any, artifacts as any);
    const result = await full.run({
      workspace_id: "ws_1",
      topic: "AI agents",
      persist: true,
      allow_guess: true,
      content_archetype: "article",
    });
    expect(result.package.depth).toBe("full");
    expect(result.package.sources.length).toBeLessThanOrEqual(MVP_LOCKS.researchSourcesFullMax);
    expect(result.package.research_questions.length).toBeGreaterThanOrEqual(1);
    expect(result.research_brief).toBeDefined();
    expect(tavily.search.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(result.persisted).toBe(true);
    expect(artifacts.saveResearchPackage).toHaveBeenCalled();
  });

  it("ResearchSkillService routes lite vs full", async () => {
    const brief = {
      raw_topic: "t",
      scope: { kind: "general_topic", topic: "t" },
      reader_job: "j",
      must_answer: [],
      must_not_invent: [],
      ambiguity: { is_ambiguous: false },
      first_party_reuse: { avoid_duplicate_angles: [], style_exemplar_post_ids: [], winning_patterns: [] },
      search_queries: ["t"],
    };
    const lite = {
      run: jest.fn(async () => ({
        package: { id: "rp_lite", depth: "lite" },
        summary: { depth: "lite" },
        provenance_errors: [],
        persisted: true,
        research_brief: brief,
        needs_clarification: false,
      })),
    };
    const full = {
      run: jest.fn(async () => ({
        package: { id: "rp_full", depth: "full" },
        summary: { depth: "full" },
        provenance_errors: [],
        coverage_retries: 0,
        persisted: true,
        research_brief: brief,
        needs_clarification: false,
      })),
    };
    const skill = new ResearchSkillService(lite as any, full as any);
    const a = await skill.run({ workspace_id: "ws", topic: "t", depth: "lite" });
    const b = await skill.run({ workspace_id: "ws", topic: "t", depth: "full" });
    expect(a.depth).toBe("lite");
    expect(b.depth).toBe("full");
    expect(lite.run).toHaveBeenCalled();
    expect(full.run).toHaveBeenCalled();
  });
});
