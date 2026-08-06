import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BusinessKnowledgeService } from "../../../../modules/strategic-intelligence/services/business-knowledge.service";
import { confidenceForSource } from "../../../../modules/strategic-intelligence/constants/business-knowledge.keys";

describe("confidenceForSource", () => {
  it("returns source-aware defaults", () => {
    expect(confidenceForSource("website_inferred")).toBe(0.5);
    expect(confidenceForSource("onboarding")).toBe(0.7);
    expect(confidenceForSource("user_explicit")).toBe(0.8);
    expect(confidenceForSource("conversation")).toBe(0.65);
    expect(confidenceForSource("onboarding_backfill")).toBe(0.55);
  });

  it("respects explicit override", () => {
    expect(confidenceForSource("onboarding", 0.9)).toBe(0.9);
  });
});

describe("BusinessKnowledgeService", () => {
  let service: BusinessKnowledgeService;
  let records: {
    listByLayer: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    upsert: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };
  let workspaceMemory: {
    ensureForSite: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
    update: jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
  };

  beforeEach(() => {
    records = {
      listByLayer: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue([]),
      upsert: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockImplementation(async (r) => r),
    };
    workspaceMemory = {
      ensureForSite: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        strategic: { business_type: "SaaS", target_audience: ["founders"] },
        preferences: { tone: "clear" },
        version: 1,
      }),
      update: jest
        .fn<(...args: unknown[]) => Promise<unknown>>()
        .mockResolvedValue({ version: 2, strategic: {}, preferences: {} }),
    };
    service = new BusinessKnowledgeService(records as never, workspaceMemory as never);
  });

  it("upsertBelief sets source and belief_status", async () => {
    const saved = await service.upsertBelief("site1", "user1", "business.audience", ["founders"], {
      source: "user_explicit",
      skipProject: true,
    });
    expect(saved.metadata.source).toBe("user_explicit");
    expect(saved.metadata.belief_status).toBe("new");
    expect(saved.metadata.confidence).toBe(0.8);
    expect(records.upsert).toHaveBeenCalled();
  });

  it("upsertFromFieldPath maps strategic.target_audience", async () => {
    const saved = await service.upsertFromFieldPath(
      "site1",
      "user1",
      "strategic.target_audience",
      "founders, CTOs",
      { source: "conversation" }
    );
    expect(saved?.canonical_key).toBe("business.audience");
    expect(Array.isArray(saved?.value)).toBe(true);
  });

  it("invalidateBelief sets confidence 0 and status invalidated", async () => {
    records.listByLayer.mockResolvedValue([
      {
        id: "mr_1",
        workspace_id: "site1",
        layer: "workspace",
        canonical_key: "business.usp",
        value: "Fast",
        value_text: "Fast",
        metadata: {
          created_at: "t",
          updated_at: "t",
          confidence: 0.7,
          importance: 1,
          version: 1,
          belief_status: "confirmed",
        },
      },
    ]);
    await service.invalidateBelief("site1", "business.usp", "contradicted");
    expect(records.upsert).toHaveBeenCalled();
    const arg = records.upsert.mock.calls[0][0] as {
      metadata: { confidence: number; belief_status: string };
    };
    expect(arg.metadata.confidence).toBe(0);
    expect(arg.metadata.belief_status).toBe("invalidated");
  });
});
