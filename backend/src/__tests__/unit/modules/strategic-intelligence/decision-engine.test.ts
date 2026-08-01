import { describe, expect, it } from "@jest/globals";
import { StrategicDecisionEngineService } from "../../../../modules/strategic-intelligence/services/strategic-decision.service";

describe("StrategicDecisionEngineService ranking", () => {
  it("ranks gather_knowledge highly when gap strategic_value is large", async () => {
    const knowledge = {
      listGaps: async () => [
        {
          key: "business.usp" as const,
          importance: 1,
          confidence: 0,
          strategic_value: 1,
          question: "What is your USP?",
          status: "missing" as const,
        },
      ],
    };
    const intelligence = {
      recompute: async () => ({
        knowledge_gaps: ["business.usp"],
        funnel_coverage: { awareness: 0.5, consideration: 0.3, conversion: 0.2 },
        unverified_assumptions: [],
        next_questions: [],
        progress_pct: 10,
        success_probability: 0.5,
        recommended_actions: ["Continue"],
        dimensions: {
          knowledge_completeness: 0.2,
          audience_understanding: 0.5,
          messaging_confidence: 0.5,
          funnel_coverage: 0.5,
          content_diversity: 0.5,
          conversion_readiness: 0.5,
          overall_confidence: 0.45,
        },
      }),
    };
    const campaigns = {
      ensureDefaultCampaign: async () => ({ _id: "def1" }),
    };
    const strategies = {
      ensureStrategy: async () => ({ _id: "strat1", confidence_summary: 0.7 }),
    };
    const campaignRepository = {
      findAll: async () => ({ data: [{ _id: "def1", is_default: true }] }),
    };

    const engine = new StrategicDecisionEngineService(
      knowledge as never,
      intelligence as never,
      campaigns as never,
      strategies as never,
      campaignRepository as never
    );

    const result = await engine.proposeNext("site1", "user1", { campaignId: "def1" });
    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.top?.kind).toBe("gather_knowledge");
    expect(result.top?.question).toMatch(/USP/i);
  });
});
