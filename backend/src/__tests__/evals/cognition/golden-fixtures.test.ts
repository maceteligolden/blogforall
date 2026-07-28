/**
 * Golden eval fixtures — conversation restraint + blog quality contracts.
 * These are structural contracts the cognition layers must satisfy.
 */

export const GOLDEN_CHAT_CASES = [
  {
    id: "ask_before_create",
    user: "write a blog",
    expect: { plan_kind: "ask", goal: "create_content" },
  },
  {
    id: "no_tool_on_chitchat",
    user: "hello there",
    focus: "writing",
    expect: { plan_kind: "respond" },
  },
  {
    id: "confirm_delete",
    user: "delete this post",
    artifacts: [{ id: "b1", kind: "blog_draft" }],
    expect: { plan_kind: "request_confirmation" },
  },
] as const;

export const BLOG_QUALITY_RUBRIC = [
  { id: "intent_match", min: 0.7 },
  { id: "grammar", min: 0.8 },
  { id: "readability", min: 0.7 },
  { id: "seo_geo", min: 0.6 },
  { id: "citations_full_mode", min_sources: 5, max_sources: 15 },
] as const;

describe("cognition eval fixtures", () => {
  it("exposes golden chat cases", () => {
    expect(GOLDEN_CHAT_CASES.length).toBeGreaterThanOrEqual(3);
  });

  it("requires citation band for full blog mode", () => {
    const cite = BLOG_QUALITY_RUBRIC.find((r) => r.id === "citations_full_mode");
    expect(cite).toMatchObject({ min_sources: 5, max_sources: 15 });
  });
});
