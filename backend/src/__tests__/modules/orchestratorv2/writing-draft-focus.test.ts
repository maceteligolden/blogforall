import { buildDraftStartFocus } from "../../../modules/orchestratorv2/orchestrator.focus";

describe("buildDraftStartFocus", () => {
  it("keeps the current topic and blog on the same thread", () => {
    const focus = buildDraftStartFocus({
      campaignId: "camp-1",
      sequence: 2,
      topic: "First post",
      intent: "Grow traffic",
      blogId: "blog-1",
    });
    expect(focus).toEqual({
      campaign_id: "camp-1",
      roadmap_sequence_index: 2,
      topic: "First post",
      intent: "Grow traffic",
      blog_id: "blog-1",
    });
    expect(focus).not.toHaveProperty("next_topic");
  });
});
