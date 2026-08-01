import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { CampaignService } from "../../../../modules/campaign/services/campaign.service";
import {
  CampaignStatus,
  CampaignLifecycleStatus,
  PostFrequency,
  CampaignType,
  CampaignContentAutonomy,
  CampaignPublishingMode,
  CampaignApprovalPolicy,
} from "../../../../shared/constants/campaign.constant";
import type { Campaign } from "../../../../shared/schemas/campaign.schema";

describe("CampaignService Default Campaign (Strategic Intelligence)", () => {
  let service: CampaignService;
  let campaignRepository: any;
  let scheduledPostRepository: any;

  const defaultCampaign = {
    _id: "camp_default",
    user_id: "user1",
    site_id: "site1",
    name: "Evergreen",
    goal: "Evergreen content",
    is_default: true,
    status: CampaignStatus.ACTIVE,
    lifecycle_status: CampaignLifecycleStatus.ACTIVE,
    campaign_type: CampaignType.CUSTOM,
    content_autonomy: CampaignContentAutonomy.ASSISTED,
    publishing_mode: CampaignPublishingMode.SCHEDULED_HITL,
    approval_policy: CampaignApprovalPolicy.REQUIRE_PRE_PUBLISH_APPROVAL,
    start_date: new Date(),
    end_date: new Date(Date.now() + 86400000 * 3650),
    posting_frequency: PostFrequency.WEEKLY,
    timezone: "UTC",
    posts_published: 0,
    created_at: new Date(),
    updated_at: new Date(),
  } as Campaign;

  beforeEach(() => {
    campaignRepository = {
      findDefault: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByDateRange: jest.fn(),
    };
    scheduledPostRepository = {
      countByCampaign: jest.fn(),
      findByCampaign: jest.fn(() => Promise.resolve([])),
      update: jest.fn(),
    };
    service = new CampaignService(campaignRepository, scheduledPostRepository);
  });

  it("returns existing default campaign without creating", async () => {
    campaignRepository.findDefault.mockResolvedValue(defaultCampaign);
    const result = await service.ensureDefaultCampaign("site1", "user1");
    expect(result.is_default).toBe(true);
    expect(campaignRepository.create).not.toHaveBeenCalled();
  });

  it("creates Evergreen default when missing", async () => {
    campaignRepository.findDefault.mockResolvedValue(null);
    campaignRepository.create.mockResolvedValue(defaultCampaign);
    const result = await service.ensureDefaultCampaign("site1", "user1");
    expect(result.name).toBe("Evergreen");
    expect(campaignRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ is_default: true, site_id: "site1", name: "Evergreen" })
    );
  });

  it("refuses to delete the default campaign", async () => {
    campaignRepository.findById.mockResolvedValue(defaultCampaign);
    await expect(service.deleteCampaign("camp_default", "site1", "user1")).rejects.toThrow(/Default \(Evergreen\)/);
  });
});
