import { describe, expect, it } from "@jest/globals";
import {
  MVP_LOCKS,
  assertResearchProvenance,
  canOptimizeAgain,
  computeOverallScore,
  conversationContextSchema,
  contentOptimizationReportSchema,
  evaluateQualityGate,
  memoryCandidateSchema,
  memoryRecordSchema,
  needsCoverageRetry,
  normalizeIntent,
  researchPackageSchema,
} from "../../../../../modules/orchestrator/ai/contracts";
import {
  CHECKPOINT_DENYLIST,
  stripDisallowedCheckpointFields,
} from "../../../../../modules/orchestrator/ai/graph/checkpoint-allowlist";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";

describe("MVP locks (ADR-008)", () => {
  it("exposes frozen numeric defaults", () => {
    expect(MVP_LOCKS.coverageMin).toBe(0.55);
    expect(MVP_LOCKS.maxSkillsPerTurn).toBe(5);
    expect(MVP_LOCKS.optimizeOverallMin).toBe(72);
    expect(MVP_LOCKS.optimizeMaxLoops).toBe(2);
  });
});

describe("conversationContextSchema", () => {
  it("parses a valid ConversationContext", () => {
    const parsed = conversationContextSchema.parse({
      communicative_category: "request_action",
      workflow_intent: "create_content",
      confidence: 0.92,
      action_required: true,
      conversation_mode: "creation",
      humor_detected: false,
      tone_preference: "professional",
      urgency: "normal",
      entities: [{ type: "topic", value: "AI agents", confidence: 0.9 }],
      references_previous_context: false,
      requires_clarification: false,
      suggested_next_action: "start_content_workflow",
      response_style: {
        brevity: "normal",
        formality: "neutral",
        initiative: "lead",
      },
      slots_patch: { topic: "AI agents" },
    });
    expect(parsed.action_required).toBe(true);
    expect(parsed.slots_patch.topic).toBe("AI agents");
  });

  it("rejects confidence outside 0–1", () => {
    expect(() =>
      conversationContextSchema.parse({
        communicative_category: "casual",
        workflow_intent: "casual",
        confidence: 1.5,
        action_required: false,
        conversation_mode: "casual",
        humor_detected: true,
        tone_preference: "friendly",
        entities: [],
        references_previous_context: false,
        requires_clarification: false,
        suggested_next_action: "casual_reply",
        response_style: {
          brevity: "short",
          formality: "casual",
          initiative: "passive",
        },
      })
    ).toThrow();
  });
});

describe("normalizeIntent", () => {
  it("maps legacy review_content to optimize_content", () => {
    expect(normalizeIntent("review_content")).toBe("optimize_content");
    expect(normalizeIntent("create_content")).toBe("create_content");
  });
});

function minimalPackage(overrides: Record<string, unknown> = {}) {
  return {
    version: 2 as const,
    id: "rp_1",
    workspace_id: "ws_1",
    created_at: "2026-07-27T00:00:00.000Z",
    depth: "lite" as const,
    topic: "AI agents",
    audience: "founders",
    search_intent: "informational",
    research_questions: [{ id: "q1", question: "What are AI agents?", priority: 1 }],
    knowledge_gaps: [],
    definitions: [
      {
        id: "f1",
        kind: "definition" as const,
        text: "An AI agent is software that acts toward goals.",
        source_id: "s1",
        confidence: 0.9,
        freshness: "evergreen" as const,
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
        category: "other" as const,
        quality_score: 0.8,
        retrieved_at: "2026-07-27T00:00:00.000Z",
      },
    ],
    references: [
      {
        source_id: "s1",
        url: "https://example.com/agents",
        title: "Agents overview",
      },
    ],
    coverage: {
      items: [{ research_question_id: "q1", status: "completed" as const }],
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
    ...overrides,
  };
}

describe("researchPackageSchema + provenance", () => {
  it("accepts a valid lite package", () => {
    const pkg = researchPackageSchema.parse(minimalPackage());
    expect(pkg.depth).toBe("lite");
    expect(assertResearchProvenance(pkg)).toEqual([]);
  });

  it("flags facts with missing source_id", () => {
    const pkg = researchPackageSchema.parse(
      minimalPackage({
        definitions: [
          {
            id: "f2",
            kind: "definition",
            text: "orphan",
            source_id: "missing",
            confidence: 0.5,
            freshness: "evergreen",
          },
        ],
      })
    );
    expect(assertResearchProvenance(pkg)[0]).toMatch(/missing source_id/);
  });

  it("applies coverage retry policy", () => {
    expect(needsCoverageRetry("full", 0.4, 0, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(true);
    expect(needsCoverageRetry("full", 0.4, 1, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(false);
    expect(needsCoverageRetry("lite", 0.1, 0, MVP_LOCKS.coverageMin, MVP_LOCKS.researchCoverageRetryMax)).toBe(false);
  });
});

function minimalOptReport(overrides: Record<string, unknown> = {}) {
  const emptyRecs = { critical: [], high: [], medium: [], low: [], writing_brief: "n/a" };
  return {
    version: 1 as const,
    id: "opt_1",
    created_at: "2026-07-27T00:00:00.000Z",
    seo: { version: 1 as const, metrics: [], aggregate: 80 },
    gao: { version: 1 as const, metrics: [], aggregate: 78 },
    authority: {
      expertise: 70,
      experience: 70,
      authority: 70,
      trust: 70,
      unsupported_claims: [],
      recommendations: [],
    },
    readability: {
      avg_sentence_length: 18,
      avg_paragraph_length: 3,
      aggregate: 75,
      recommendations: [],
    },
    ux: {
      hook_quality: 70,
      pacing: 70,
      section_flow: 70,
      cta_effectiveness: 70,
      visual_opportunities: [],
      aggregate: 70,
      recommendations: [],
    },
    validator_results: [],
    plan: { version: 1 as const, ...emptyRecs },
    quality: {
      seo: 80,
      gao: 78,
      authority: 70,
      readability: 75,
      ux: 70,
      factual_confidence: 80,
      overall: computeOverallScore({
        seo: 80,
        gao: 78,
        authority: 70,
        readability: 75,
        ux: 70,
        factual_confidence: 80,
      }),
      weights: {
        seo: 0.25 as const,
        gao: 0.25 as const,
        authority: 0.15 as const,
        readability: 0.15 as const,
        ux: 0.1 as const,
        factual_confidence: 0.1 as const,
      },
    },
    quality_gate_passed: true,
    ...overrides,
  };
}

describe("contentOptimizationReportSchema + gate", () => {
  it("parses a report and evaluates gate", () => {
    const report = contentOptimizationReportSchema.parse(minimalOptReport());
    expect(report.quality.overall).toBeGreaterThanOrEqual(72);
    expect(evaluateQualityGate(report.quality.overall, report.plan.critical.length)).toBe(true);
  });

  it("fails gate when Critical items exist even if overall high", () => {
    expect(evaluateQualityGate(90, 1)).toBe(false);
  });

  it("bounds optimize loops", () => {
    expect(canOptimizeAgain(0)).toBe(true);
    expect(canOptimizeAgain(1)).toBe(true);
    expect(canOptimizeAgain(2)).toBe(false);
  });
});

describe("memory schemas", () => {
  it("parses MemoryCandidate and MemoryRecord", () => {
    const candidate = memoryCandidateSchema.parse({
      turn_id: "t1",
      workspace_id: "ws1",
      source: "user_utterance",
      proposed_layer: "user_preference",
      proposed_key: "tone",
      proposed_value: "conversational",
      confidence: 0.8,
    });
    expect(candidate.proposed_key).toBe("tone");

    const record = memoryRecordSchema.parse({
      id: "m1",
      workspace_id: "ws1",
      user_id: "u1",
      layer: "user_preference",
      canonical_key: "tone",
      value: "conversational",
      metadata: {
        created_at: "2026-07-27T00:00:00.000Z",
        updated_at: "2026-07-27T00:00:00.000Z",
        confidence: 0.8,
        importance: 0.7,
        version: 1,
      },
    });
    expect(record.layer).toBe("user_preference");
  });
});

describe("OrchestratorState + checkpoint allowlist", () => {
  it("creates initial state with max_skills_per_turn lock", () => {
    const state = createInitialOrchestratorState({
      turn_id: "turn_1",
      thread_id: "thread_1",
      workspace_id: "ws_1",
      user_id: "user_1",
      message: "Write a blog about AI agents",
      current_time_iso: "2026-07-27T12:00:00.000Z",
      current_date_human: "Monday, July 27, 2026",
    });
    expect(state.max_skills_per_turn).toBe(5);
    expect(state.workflow_stage).toBe("idle");
    expect(state.memory_candidates).toEqual([]);
  });

  it("strips denylisted checkpoint fields", () => {
    const stripped = stripDisallowedCheckpointFields({
      turn_id: "t1",
      research_package: { huge: true },
      secrets: { apiKey: "x" },
      memory_candidates: [],
    });
    expect(stripped.turn_id).toBe("t1");
    expect(stripped.memory_candidates).toEqual([]);
    expect((stripped as Record<string, unknown>).research_package).toBeUndefined();
    expect((stripped as Record<string, unknown>).secrets).toBeUndefined();
    expect(CHECKPOINT_DENYLIST).toContain("research_package");
  });
});
