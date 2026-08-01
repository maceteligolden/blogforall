import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";

const mockUserFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockFindByOwner = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();
const mockFindByUser = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();
const mockUpdate = jest.fn<() => Promise<unknown>>();

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
        update: mockUpdate,
      } as never,
      {} as never,
    );
  });

  it("returns email_verification when email_verified is explicitly false", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1", email_verified: false });

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.EMAIL_VERIFICATION });
  });

  it("returns company_role when verified user has no role and no sites", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1", email_verified: true });
    mockFindByOwner.mockResolvedValue([]);
    mockFindByUser.mockResolvedValue([]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.COMPANY_ROLE });
  });

  it("returns workspace_name when user has company_role but owns no sites", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1", company_role: "founder" });
    mockFindByOwner.mockResolvedValue([]);
    mockFindByUser.mockResolvedValue([]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.WORKSPACE_NAME });
  });

  it("returns complete for invited members with site access but no owned sites", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1" });
    mockFindByOwner.mockResolvedValue([]);
    mockFindByUser.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.COMPLETE });
  });

  it("promotes onboarding sites to active and returns plan_selection", async () => {
    mockUserFindById.mockResolvedValue({ _id: "u1", plan_selection_completed_at: null });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ONBOARDING }]);
    mockUpdate.mockResolvedValue({});

    const status = await service.getSignupWizardStatus("u1");

    expect(mockUpdate).toHaveBeenCalledWith("s1", { status: SiteStatus.ACTIVE });
    expect(status).toEqual({ stage: SignupWizardStage.PLAN_SELECTION, site_id: "s1" });
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
