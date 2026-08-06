import { describe, expect, it } from "@jest/globals";
import { buildResearchBrief } from "../../../../modules/blog/ai/contracts/research-brief";
import { resolveStyleProfile } from "../../../../modules/blog/ai/contracts/style-profile";
import { coerceContentArchetype } from "../../../../modules/blog/ai/contracts/content-archetype";
import { routeResearchNotes } from "../../../../modules/blog/ai/contracts/signal-router";
import { runArchetypeQualityValidator } from "../../../../modules/blog/ai/archetype-quality";

describe("content archetype + style profile", () => {
  it("coerces UI labels to archetypes", () => {
    expect(coerceContentArchetype("tutorial")).toBe("how_to");
    expect(coerceContentArchetype("guide")).toBe("definitive_guide");
    expect(coerceContentArchetype("opinion")).toBe("thought_leadership");
    expect(coerceContentArchetype("case-study")).toBe("case_study");
  });

  it("picks war_story_howto when personal notes present", () => {
    const profile = resolveStyleProfile({
      archetype: "how_to",
      personal_notes: "I was debugging at 2am when the feed failed",
      topic: "webhooks",
      site_id: "s1",
      seed: "fixed",
    });
    expect(profile.variant).toBe("war_story_howto");
    expect(profile.craft.pronoun_stance).toBe("I");
    expect(profile.research_needs).toContain("lived_user_words");
  });

  it("keeps variant stable for same seed", () => {
    const a = resolveStyleProfile({ archetype: "listicle", topic: "tips", site_id: "s1", seed: "s1|tips|2026-W1" });
    const b = resolveStyleProfile({ archetype: "listicle", topic: "tips", site_id: "s1", seed: "s1|tips|2026-W1" });
    expect(a.variant).toBe(b.variant);
  });
});

describe("research brief disambiguation", () => {
  it("flags vague man-who-fights-bears topics", () => {
    const brief = buildResearchBrief({
      topic: "a man that fights bears",
      allow_guess: false,
    });
    expect(brief.ambiguity.is_ambiguous).toBe(true);
    expect(brief.search_queries).toEqual([]);
    expect(brief.ambiguity.options?.length).toBeGreaterThan(0);
  });

  it("resolves clarify choice to general topic", () => {
    const brief = buildResearchBrief({
      topic: "a man that fights bears",
      clarify_choice: "The general topic / phenomenon",
      allow_guess: false,
    });
    expect(brief.ambiguity.is_ambiguous).toBe(false);
    expect(brief.scope.kind).toBe("general_topic");
    expect(brief.search_queries.length).toBeGreaterThan(0);
  });

  it("does not search brand_owned personal notes", () => {
    const brief = buildResearchBrief({
      topic: "my commute",
      personal_notes: "personal story: I was riding home and felt conflicted",
    });
    expect(brief.scope.kind).toBe("brand_owned");
    expect(brief.search_queries).toEqual([]);
  });
});

describe("signal router", () => {
  it("promotes user notes and scores how-to needs", () => {
    const profile = resolveStyleProfile({ archetype: "how_to", variant: "operator_checklist", seed: "x" });
    const routed = routeResearchNotes(
      [
        { title: "Essay", snippet: "AI is transforming the landscape", source: "web" },
        { title: "Docs", snippet: "Click Settings then copy the webhook URL step by step", source: "web" },
      ],
      profile,
      { personalNotes: "We fixed it by checking the timestamp", maxKeep: 5 }
    );
    expect(routed[0]?.source).toBe("user");
    expect(routed.some((n) => /webhook|Settings/i.test(n.snippet))).toBe(true);
  });
});

describe("archetype quality validator", () => {
  it("flags What Is H2 on how-to", () => {
    const result = runArchetypeQualityValidator({
      title: "How to set up billing webhooks",
      content: "<h2>What Is a Webhook</h2><p>A webhook is important.</p><h2>Open Settings</h2><p>Click billing.</p>",
      archetype: "how_to",
    });
    expect(result.issues.some((i: { code: string }) => i.code === "forbidden_h2")).toBe(true);
  });

  it("flags listicle count mismatch", () => {
    const result = runArchetypeQualityValidator({
      title: "7 tips for focus",
      content: "<h2>Tip one</h2><p>x</p><h2>Tip two</h2><p>y</p>",
      archetype: "listicle",
    });
    expect(result.issues.some((i: { code: string }) => i.code === "listicle_count_mismatch")).toBe(true);
  });

  it("flags thin definitive guide with definitive title", () => {
    const body = "<h2>Overview</h2><p>" + "word ".repeat(500) + "</p>";
    const result = runArchetypeQualityValidator({
      title: "The Definitive Guide to Pricing",
      content: body,
      archetype: "definitive_guide",
    });
    expect(result.issues.some((i: { code: string }) => i.code === "definitive_thin")).toBe(true);
  });
});
