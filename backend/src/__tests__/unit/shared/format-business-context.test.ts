import { describe, expect, it } from "@jest/globals";
import { formatBusinessContextForPrompt, formatBusinessOneLiner } from "../../../shared/utils/format-business-context";
import { migrateStrategicMemory } from "../../../shared/utils/migrate-strategic-memory";
import { migrateCompetitiveNotes, normalizeCustomers } from "../../../shared/types/business-profile";

describe("migrateStrategicMemory", () => {
  it("migrates business_type into business_description", () => {
    const s = migrateStrategicMemory({
      business_type: "We sell analytics to startups",
      target_audience: [],
      customers: [],
      business_goals: [],
      seo_priorities: [],
      publishing_channels: [],
      industries: [],
      competitors: [],
    });
    expect(s.business_description).toBe("We sell analytics to startups");
  });

  it("seeds customers from audience labels", () => {
    const s = migrateStrategicMemory({
      target_audience: ["Founders", "CTOs"],
      customers: [],
      business_goals: [],
      seo_priorities: [],
      publishing_channels: [],
      industries: [],
      competitors: [],
    });
    expect(s.customers).toHaveLength(2);
    expect(s.customers[0]).toMatchObject({ who: "Founders", label: "Founders" });
  });

  it("migrates competitive_notes into competitors", () => {
    const s = migrateStrategicMemory({
      competitive_notes: "Acme Corp\nBeta Inc",
      target_audience: [],
      customers: [],
      business_goals: [],
      seo_priorities: [],
      publishing_channels: [],
      industries: [],
      competitors: [],
    });
    expect(s.competitors.map((c) => c.name)).toEqual(["Acme Corp", "Beta Inc"]);
  });
});

describe("normalizeCustomers / migrateCompetitiveNotes", () => {
  it("normalizes string customer arrays", () => {
    expect(normalizeCustomers(["A", "B"])).toEqual([
      { who: "A", label: "A" },
      { who: "B", label: "B" },
    ]);
  });

  it("keeps prose competitive notes as a single Notes row", () => {
    const notes = "They compete on price but we win on support quality.";
    expect(migrateCompetitiveNotes(notes)).toEqual([{ name: "Notes", notes }]);
  });
});

describe("formatBusinessContextForPrompt", () => {
  it("includes description, customers, voice, negatives, and competitors", () => {
    const text = formatBusinessContextForPrompt({
      industries: ["SaaS"],
      business_model: "b2b",
      business_description: "Analytics for growth teams.",
      target_audience: ["Founders"],
      customers: [
        {
          who: "Startup founders",
          pain_points: "No clear funnel insights",
          success: "Ship weekly experiments with confidence",
          label: "Founders",
        },
      ],
      brand_voice: "Clear and confident without hype.",
      brand_negatives: "Avoid buzzwords and fear-based CTAs.",
      business_goals: ["Grow signups"],
      seo_priorities: [],
      publishing_channels: [],
      competitors: [{ name: "Acme", notes: "Cheaper but shallow" }],
    });
    expect(text).toContain("Industries: SaaS");
    expect(text).toContain("Business model: B2B");
    expect(text).toContain("Analytics for growth teams");
    expect(text).toContain("Pain points:");
    expect(text).toContain("Brand avoidances:");
    expect(text).toContain("Acme");
  });

  it("formatBusinessOneLiner prefers business_description", () => {
    expect(
      formatBusinessOneLiner({
        business_description: "Paragraph about the business",
        business_type: "legacy",
        target_audience: [],
        customers: [],
        business_goals: [],
        seo_priorities: [],
        publishing_channels: [],
        industries: [],
        competitors: [],
      })
    ).toBe("Paragraph about the business");
  });
});
