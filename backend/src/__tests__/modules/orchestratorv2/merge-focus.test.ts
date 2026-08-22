import { mergeFocus } from "../../../modules/orchestratorv2/orchestrator.focus";

describe("mergeFocus", () => {
  it("keeps blog_id when the same campaign topic is resumed without one", () => {
    const merged = mergeFocus(
      { campaign_id: "camp-1", roadmap_sequence_index: 0, blog_id: "blog-1", topic: "First post" },
      { campaign_id: "camp-1", roadmap_sequence_index: 0, topic: "First post" }
    );
    expect(merged?.blog_id).toBe("blog-1");
  });

  it("drops blog_id when switching to a different roadmap topic", () => {
    const merged = mergeFocus(
      { campaign_id: "camp-1", roadmap_sequence_index: 0, blog_id: "blog-1", topic: "First post" },
      { campaign_id: "camp-1", roadmap_sequence_index: 1, topic: "Second post" }
    );
    expect(merged?.blog_id).toBeUndefined();
    expect(merged?.roadmap_sequence_index).toBe(1);
  });
});
