import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";

const mockUserFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockFindByOwner = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();
const mockFindByUser = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();

jest.mock("../../../shared/schemas/user.schema", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

import User from "../../../shared/schemas/user.schema";
import { OnboardingService } from "../../../modules/onboarding/services/onboarding.service";

const mockedUser = User as unknown as {
  findById: typeof mockUserFindById;
};

describe("OnboardingService.getSignupWizardStatus", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUser.findById = mockUserFindById;
    service = new OnboardingService(
      {} as never,
      {
        findByOwner: mockFindByOwner,
        findByUser: mockFindByUser,
      } as never
    );
  });

  it("returns workspace_name when user owns no sites and has no access", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1" });
    mockFindByOwner.mockResolvedValue([]);
    mockFindByUser.mockResolvedValue([]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.WORKSPACE_NAME });
  });

  it("returns business_chat when an owned site is onboarding", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1" });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ONBOARDING }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.BUSINESS_CHAT, site_id: "s1" });
  });

  it("returns plan_selection when site is active but plan not confirmed", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1", plan_selection_completed_at: null });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.PLAN_SELECTION, site_id: "s1" });
  });

  it("returns invite when plan selected but invite prompt not dismissed", async () => {
    mockUserFindById.mockResolvedValue({
      _id: "u1",
      plan_selection_completed_at: new Date(),
      workspace_invite_prompt_dismissed_at: null,
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.INVITE, site_id: "s1" });
  });

  it("returns complete when wizard finished", async () => {
    mockUserFindById.mockResolvedValue({
      _id: "u1",
      plan_selection_completed_at: new Date(),
      workspace_invite_prompt_dismissed_at: new Date(),
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.COMPLETE, site_id: "s1" });
  });
});
