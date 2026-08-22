import { seedThreadTitle } from "../../../modules/orchestrator/utils/thread-seed-title.helper";

describe("seedThreadTitle", () => {
  it("uses topic first as an auto title", () => {
    expect(seedThreadTitle({ topic: "SEO for local gyms", blogTitle: "Draft", campaignName: "Launch" })).toEqual({
      title: "SEO for local gyms",
      title_source: "auto",
    });
  });

  it("seeds a post title", () => {
    expect(seedThreadTitle({ blogTitle: "How to price a newsletter" })).toEqual({
      title: "Draft: How to price a newsletter",
      title_source: "auto",
    });
  });

  it("seeds a campaign name", () => {
    expect(seedThreadTitle({ campaignName: "Q3 launch" })).toEqual({
      title: "Q3 launch",
      title_source: "auto",
    });
  });

  it("defaults when there is no entity context", () => {
    expect(seedThreadTitle({})).toEqual({
      title: "New conversation",
      title_source: "default",
    });
  });
});
