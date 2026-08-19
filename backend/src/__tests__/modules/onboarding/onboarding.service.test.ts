import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";
import { CampaignRoadmapStatus } from "../../../shared/constants/campaign.constant";
import { ForbiddenError, TooManyRequestsError } from "../../../shared/errors";
import { OnboardingService } from "../../../modules/onboarding/services/onboarding.service";
import { __resetSlidingWindowRateLimitForTests } from "../../../shared/utils/sliding-window-rate-limit";

const mockUserFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockUserUpdate = jest.fn<(id: string, patch: Record<string, unknown>) => Promise<unknown>>();
const mockFindByOwner = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus; owner?: string }>>>();
const mockFindByUser = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();
const mockSiteUpdate = jest.fn<() => Promise<unknown>>();
const mockFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockGetActive = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockFindDefault = jest.fn<() => Promise<{ _id: string } | null>>();
const mockFindLatest = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockFinalize = jest.fn<() => Promise<void>>();
const mockCreateGeneratingStub = jest.fn<() => Promise<unknown>>();
const mockStartBackgroundGenerate = jest.fn();
const mockEnsureDefaultRoadmap = jest.fn<() => Promise<void>>();
const mockGetActiveSubscription = jest.fn<() => Promise<unknown>>();
const mockCreateFreeSubscription = jest.fn<() => Promise<void>>();

function ownerUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: "u1",
    email_verified: true,
    company_role: "founder",
    ...overrides,
  };
}

const readyStrategy = {
  generation_status: "ready",
  document: {
    north_star: { what_we_are: "A SaaS for writers" },
    positioning: { statement: "We help teams publish" },
    audience: { primary: { who: "Founders" } },
    narrative: { core_message: "Write with a strategist" },
  },
};

function makeOnboardingService() {
  return new OnboardingService(
    {
      getActiveSubscription: mockGetActiveSubscription,
      createFreeSubscription: mockCreateFreeSubscription,
    } as never,
    {
      findByOwner: mockFindByOwner,
      findByUser: mockFindByUser,
      findById: mockFindById,
      update: mockSiteUpdate,
    } as never,
    { finalizeSignupCompletion: mockFinalize } as never,
    {} as never,
    {} as never,
    {
      findById: mockUserFindById,
      update: mockUserUpdate,
    } as never,
    {
      getActive: mockGetActive,
      createGeneratingStub: mockCreateGeneratingStub,
      startBackgroundGenerate: mockStartBackgroundGenerate,
    } as never,
    { findDefault: mockFindDefault } as never,
    { findLatest: mockFindLatest } as never,
    { ensureDefaultRoadmap: mockEnsureDefaultRoadmap } as never
  );
}

describe("OnboardingService.getSignupWizardStatus", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureDefaultRoadmap.mockResolvedValue(undefined);
    service = makeOnboardingService();
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

  it("returns plan_selection after role when the user owns no sites", async () => {
    mockUserFindById.mockResolvedValue(ownerUser());
    mockFindByOwner.mockResolvedValue([]);
    mockFindByUser.mockResolvedValue([]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.PLAN_SELECTION });
  });

  it("returns workspace_name after plan selection when the user owns no sites", async () => {
    mockUserFindById.mockResolvedValue(ownerUser({ plan_selection_completed_at: new Date() }));
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

  it("promotes onboarding sites to active without auto-completing the wizard", async () => {
    mockUserFindById.mockResolvedValue(ownerUser({ plan_selection_completed_at: null }));
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ONBOARDING }]);
    mockSiteUpdate.mockResolvedValue({});

    const status = await service.getSignupWizardStatus("u1");

    expect(mockSiteUpdate).toHaveBeenCalledWith("s1", { status: SiteStatus.ACTIVE });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(status).toEqual({ stage: SignupWizardStage.PLAN_SELECTION, site_id: "s1" });
  });

  it("does not stamp plan or invite timestamps when a workspace exists", async () => {
    mockUserFindById.mockResolvedValue(ownerUser({ plan_selection_completed_at: null }));
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(status).toEqual({ stage: SignupWizardStage.PLAN_SELECTION, site_id: "s1" });
  });

  it("returns invite after plan selection when a workspace exists", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: null,
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.INVITE, site_id: "s1" });
  });

  it("returns strategist_setup after invite until bootstrap is ready", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockGetActive.mockResolvedValue({ generation_status: "generating", document: {} });
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue(null);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
    expect(mockEnsureDefaultRoadmap).not.toHaveBeenCalled();
  });

  it("returns strategist_ready when bootstrap is ready and not acknowledged", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockGetActive.mockResolvedValue(readyStrategy);
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue({
      status: CampaignRoadmapStatus.APPROVED,
      items: [{ title: "First post" }],
    });

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_READY, site_id: "s1" });
    expect(mockEnsureDefaultRoadmap).not.toHaveBeenCalled();
  });

  it("returns complete when existing owners already finished plan, invite, and strategist ready", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
        strategist_ready_acknowledged_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.COMPLETE, site_id: "s1" });
  });
});

describe("OnboardingService.getStrategistProgress", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureDefaultRoadmap.mockResolvedValue(undefined);
    service = makeOnboardingService();
  });

  it("kicks default roadmap generation when strategy is ready and no roadmap exists", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1" });
    mockFindByUser.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockGetActive.mockResolvedValue(readyStrategy);
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue(null);

    const progress = await service.getStrategistProgress("u1", "s1");

    expect(mockEnsureDefaultRoadmap).toHaveBeenCalledWith("s1", "u1");
    expect(progress.steps.find((s) => s.id === "campaign_topics")?.status).toBe("in_progress");
    expect(progress.ready).toBe(false);
  });

  it("rejects progress for users who are not workspace members", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u2" });
    mockFindByUser.mockResolvedValue([]);

    await expect(service.getStrategistProgress("u1", "s1")).rejects.toThrow(ForbiddenError);
    expect(mockEnsureDefaultRoadmap).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.retryStrategistProgress", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetSlidingWindowRateLimitForTests();
    mockEnsureDefaultRoadmap.mockResolvedValue(undefined);
    service = makeOnboardingService();
  });

  it("retries only campaign topics when content strategy is already ready", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://example.com" });
    mockGetActive.mockResolvedValue(readyStrategy);
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue({
      status: CampaignRoadmapStatus.APPROVED,
      items: [{ title: "First post" }],
    });

    await service.retryStrategistProgress("u1", "s1");

    expect(mockEnsureDefaultRoadmap).toHaveBeenCalledWith("s1", "u1");
    expect(mockCreateGeneratingStub).not.toHaveBeenCalled();
    expect(mockStartBackgroundGenerate).not.toHaveBeenCalled();
  });

  it("regenerates content strategy when it is not ready", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://example.com" });
    mockGetActive.mockResolvedValue({ generation_status: "failed", document: {} });
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue(null);

    await service.retryStrategistProgress("u1", "s1");

    expect(mockCreateGeneratingStub).toHaveBeenCalledWith("s1", "u1", "https://example.com");
    expect(mockStartBackgroundGenerate).toHaveBeenCalledWith("s1", "u1", "https://example.com");
    expect(mockEnsureDefaultRoadmap).not.toHaveBeenCalled();
  });

  it("rejects retry from anyone who is not the workspace owner", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u2", website_url: "https://example.com" });

    await expect(service.retryStrategistProgress("u1", "s1")).rejects.toThrow(ForbiddenError);
    expect(mockEnsureDefaultRoadmap).not.toHaveBeenCalled();
    expect(mockCreateGeneratingStub).not.toHaveBeenCalled();
  });

  it("rate-limits retry to five attempts per hour", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://example.com" });
    mockGetActive.mockResolvedValue(readyStrategy);
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue({
      status: CampaignRoadmapStatus.APPROVED,
      items: [{ title: "First post" }],
    });

    for (let i = 0; i < 5; i += 1) {
      await service.retryStrategistProgress("u1", "s1");
    }

    await expect(service.retryStrategistProgress("u1", "s1")).rejects.toThrow(TooManyRequestsError);
    expect(mockEnsureDefaultRoadmap).toHaveBeenCalledTimes(5);
  });
});

describe("OnboardingService.acknowledgeStrategistReady", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnsureDefaultRoadmap.mockResolvedValue(undefined);
    service = makeOnboardingService();
  });

  it("is idempotent when already acknowledged", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
        strategist_ready_acknowledged_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const status = await service.acknowledgeStrategistReady("u1");

    expect(mockFinalize).not.toHaveBeenCalled();
    expect(status).toEqual({ stage: SignupWizardStage.COMPLETE, site_id: "s1" });
  });

  it("stamps acknowledgement and finalizes signup once", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockGetActive.mockResolvedValue(readyStrategy);
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue({
      status: CampaignRoadmapStatus.APPROVED,
      items: [{ title: "First post" }],
    });
    mockUserUpdate.mockResolvedValue({});
    mockFinalize.mockResolvedValue(undefined);

    const status = await service.acknowledgeStrategistReady("u1");

    expect(mockUserUpdate).toHaveBeenCalled();
    expect(mockFinalize).toHaveBeenCalledWith("u1");
    expect(status).toEqual({ stage: SignupWizardStage.COMPLETE, site_id: "s1" });
  });

  it("rejects acknowledge until strategist setup is ready", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockGetActive.mockResolvedValue({ generation_status: "generating", document: {} });
    mockFindDefault.mockResolvedValue({ _id: "c1" });
    mockFindLatest.mockResolvedValue(null);

    await expect(service.acknowledgeStrategistReady("u1", true)).rejects.toThrow(
      /Finish strategist setup before continuing/
    );
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.completePlanSelection", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveSubscription.mockResolvedValue({
      plan: { price: 0, interval: "free" },
      subscription: { status: "free" },
    });
    mockCreateFreeSubscription.mockResolvedValue(undefined);
    mockUserUpdate.mockResolvedValue({});
    service = makeOnboardingService();
  });

  it("stamps plan_selection_completed_at without completing onboarding", async () => {
    mockUserFindById.mockResolvedValue(ownerUser({ plan_selection_completed_at: null }));

    await service.completePlanSelection("u1");

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    const patch = mockUserUpdate.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch.plan_selection_completed_at).toBeInstanceOf(Date);
    expect(patch).not.toHaveProperty("onboarding_completed");
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("does not restamp when plan selection is already complete", async () => {
    mockUserFindById.mockResolvedValue(ownerUser({ plan_selection_completed_at: new Date() }));

    await service.completePlanSelection("u1");

    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.skipOnboarding", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveSubscription.mockResolvedValue({
      plan: { price: 0, interval: "free" },
      subscription: { status: "free" },
    });
    service = makeOnboardingService();
  });

  it("ensures a free subscription without marking the wizard complete", async () => {
    mockUserFindById.mockResolvedValue(ownerUser());

    await service.skipOnboarding("u1");

    expect(mockGetActiveSubscription).toHaveBeenCalledWith("u1");
    expect(mockCreateFreeSubscription).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
  });

  it("creates a free subscription when none exists and still leaves onboarding incomplete", async () => {
    mockUserFindById.mockResolvedValue(ownerUser());
    mockGetActiveSubscription.mockRejectedValue(new Error("none"));
    mockCreateFreeSubscription.mockResolvedValue(undefined);

    await service.skipOnboarding("u1");

    expect(mockCreateFreeSubscription).toHaveBeenCalledWith("u1");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
