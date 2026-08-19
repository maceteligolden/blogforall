import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CampaignRoadmapService } from "../../../../modules/campaign/services/campaign-roadmap.service";
import {
  CampaignLifecycleStatus,
  CampaignRoadmapStatus,
  CampaignStatus,
} from "../../../../shared/constants/campaign.constant";

describe("CampaignRoadmapService.approveRoadmap", () => {
  const proposed = {
    _id: "r1",
    version: 1,
    status: CampaignRoadmapStatus.PROPOSED,
    items: [
      {
        sequence_index: 0,
        title: "SEO playbooks",
        about: "How teams ship SEO content",
        objective: "Teach a repeatable workflow",
        strategic_intent: "authority",
        narrative_phase: "educate",
        scheduled_at: new Date("2026-01-08T00:00:00.000Z"),
        keywords: ["seo"],
        post_type: "how-to",
      },
    ],
  };

  const campaign = {
    _id: "c1",
    timezone: "UTC",
  };

  let findLatest: jest.MockedFunction<() => Promise<typeof proposed | null>>;
  let materialize: jest.MockedFunction<() => Promise<void>>;
  let createMany: jest.MockedFunction<() => Promise<void>>;
  let updateStatus: jest.MockedFunction<() => Promise<typeof proposed>>;
  let service: CampaignRoadmapService;

  beforeEach(() => {
    findLatest = jest.fn<() => Promise<typeof proposed | null>>();
    materialize = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    createMany = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    updateStatus = jest.fn<() => Promise<typeof proposed>>().mockResolvedValue({
      ...proposed,
      status: CampaignRoadmapStatus.APPROVED,
    });
    service = new CampaignRoadmapService(
      {
        findById: jest.fn(async () => campaign),
        update: jest.fn(async () => campaign),
      } as never,
      {
        findLatest,
        listVersions: jest.fn(async () => []),
        updateStatus,
      } as never,
      {
        deleteByCampaign: jest.fn(async () => undefined),
        createMany,
        findByCampaign: jest.fn(async () => []),
      } as never,
      { append: jest.fn(async () => undefined) } as never,
      { materialize } as never,
      { recordDecision: jest.fn(async () => undefined) } as never,
      {
        findPendingCampaignRoadmap: jest.fn(async () => null),
        decide: jest.fn(async () => undefined),
        markExecuted: jest.fn(async () => undefined),
      } as never,
      {} as never,
      { emitToUser: jest.fn() } as never
    );
  });

  it("approves topics without materializing scheduled posts when skipMaterialize is set", async () => {
    findLatest
      .mockResolvedValueOnce(proposed)
      .mockResolvedValue({ ...proposed, status: CampaignRoadmapStatus.APPROVED });

    await service.approveRoadmap("c1", "site1", "user1", { skipMaterialize: true });

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith("r1", "site1", CampaignRoadmapStatus.APPROVED);
    expect(materialize).not.toHaveBeenCalled();
  });

  it("materializes scheduled posts on a normal approve", async () => {
    findLatest
      .mockResolvedValueOnce(proposed)
      .mockResolvedValue({ ...proposed, status: CampaignRoadmapStatus.APPROVED });

    await service.approveRoadmap("c1", "site1", "user1");

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(materialize).toHaveBeenCalledWith("c1", "site1", "user1");
  });

  it("does not rematerialize an already approved roadmap when skipMaterialize is set", async () => {
    findLatest.mockResolvedValue({ ...proposed, status: CampaignRoadmapStatus.APPROVED });

    await service.approveRoadmap("c1", "site1", "user1", { skipMaterialize: true });

    expect(createMany).not.toHaveBeenCalled();
    expect(materialize).not.toHaveBeenCalled();
  });

  it("activates the campaign when a proposed roadmap is approved", async () => {
    const campaignUpdate = jest.fn(async () => campaign);
    service = new CampaignRoadmapService(
      {
        findById: jest.fn(async () => campaign),
        update: campaignUpdate,
      } as never,
      {
        findLatest,
        listVersions: jest.fn(async () => []),
        updateStatus,
      } as never,
      {
        deleteByCampaign: jest.fn(async () => undefined),
        createMany,
        findByCampaign: jest.fn(async () => []),
      } as never,
      { append: jest.fn(async () => undefined) } as never,
      { materialize } as never,
      { recordDecision: jest.fn(async () => undefined) } as never,
      {
        findPendingCampaignRoadmap: jest.fn(async () => null),
        decide: jest.fn(async () => undefined),
        markExecuted: jest.fn(async () => undefined),
      } as never,
      {} as never,
      { emitToUser: jest.fn() } as never
    );
    findLatest
      .mockResolvedValueOnce(proposed)
      .mockResolvedValue({ ...proposed, status: CampaignRoadmapStatus.APPROVED });

    await service.approveRoadmap("c1", "site1", "user1", { skipMaterialize: true });

    expect(campaignUpdate).toHaveBeenCalledWith(
      "c1",
      "site1",
      expect.objectContaining({
        lifecycle_status: CampaignLifecycleStatus.ACTIVE,
        status: CampaignStatus.ACTIVE,
      })
    );
  });
});
