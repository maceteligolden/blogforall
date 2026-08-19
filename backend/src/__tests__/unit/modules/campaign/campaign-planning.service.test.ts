import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CampaignPlanningService } from "../../../../modules/campaign/services/campaign-planning.service";
import { PostFrequency, SIGNUP_DEFAULT_ROADMAP_TOPICS } from "../../../../shared/constants/campaign.constant";
import { parseContentStrategyDocument } from "../../../../shared/types/content-strategy.document";

describe("CampaignPlanningService.ensureDefaultRoadmap", () => {
  const document = parseContentStrategyDocument({
    north_star: { what_we_are: "A SaaS for writers" },
    narrative: { core_message: "Write with a strategist" },
    content_franchise: {
      pillars: [
        { name: "SEO playbooks" },
        { name: "Team workflow" },
        { name: "Editorial voice" },
        { name: "Distribution systems" },
      ],
    },
  });

  const campaign = {
    _id: "c1",
    is_default: true,
    name: "Evergreen",
    goal: "Evergreen content aligned with the workspace strategy",
    start_date: new Date("2026-01-01T00:00:00.000Z"),
    end_date: new Date("2036-01-01T00:00:00.000Z"),
    posting_frequency: PostFrequency.WEEKLY,
    total_posts_planned: 12,
    campaign_type: "custom",
  };

  let suggestCampaignTopics: jest.Mock;
  let findLatest: jest.Mock;
  let createRoadmap: jest.Mock;
  let approveRoadmap: jest.Mock;
  let service: CampaignPlanningService;

  beforeEach(() => {
    suggestCampaignTopics = jest.fn();
    findLatest = jest.fn();
    createRoadmap = jest.fn(async (doc: unknown) => ({ _id: "r1", ...(doc as object) }));
    approveRoadmap = jest.fn(async () => undefined);
    service = new CampaignPlanningService(
      {
        findDefault: jest.fn(async () => campaign),
        findById: jest.fn(async () => campaign),
        update: jest.fn(async () => campaign),
      } as never,
      {
        findLatest,
        nextVersion: jest.fn(async () => 1),
        create: createRoadmap,
      } as never,
      { ensureForCampaign: jest.fn(async () => undefined) } as never,
      { append: jest.fn(async () => undefined) } as never,
      { create: jest.fn(async () => undefined) } as never,
      { suggestCampaignTopics } as never,
      {
        getActive: jest.fn(async () => ({ generation_status: "ready", document })),
        requireReady: jest.fn(async () => ({ document })),
      } as never,
      { approveRoadmap } as never
    );
  });

  it("creates four strategy-seeded topics without running campaign research", async () => {
    findLatest.mockImplementation(async () => null);

    await service.ensureDefaultRoadmap("site1", "user1");

    expect(suggestCampaignTopics).not.toHaveBeenCalled();
    expect(createRoadmap).toHaveBeenCalledTimes(1);
    const created = createRoadmap.mock.calls[0]?.[0] as { items: Array<{ title: string }> };
    expect(created.items).toHaveLength(SIGNUP_DEFAULT_ROADMAP_TOPICS);
    expect(created.items.map((item) => item.title)).toEqual([
      "SEO playbooks",
      "Team workflow",
      "Editorial voice",
      "Distribution systems",
    ]);
    expect(approveRoadmap).toHaveBeenCalledWith(
      "c1",
      "site1",
      "user1",
      expect.objectContaining({ skipMaterialize: true })
    );
  });

  it("coalesces overlapping ensureDefaultRoadmap calls for the same site", async () => {
    let resolveLatest: (value: null) => void = () => undefined;
    const firstLookup = new Promise<null>((resolve) => {
      resolveLatest = resolve;
    });
    findLatest.mockImplementationOnce(() => firstLookup).mockImplementation(async () => null);

    const first = service.ensureDefaultRoadmap("site-coalesce", "user1");
    const second = service.ensureDefaultRoadmap("site-coalesce", "user1");
    resolveLatest(null);
    await Promise.all([first, second]);

    expect(createRoadmap).toHaveBeenCalledTimes(1);
  });
});
