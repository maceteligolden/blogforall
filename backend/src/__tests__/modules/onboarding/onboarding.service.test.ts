import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";
import { ForbiddenError, TooManyRequestsError } from "../../../shared/errors";
import { OnboardingService, type StrategistProgress } from "../../../modules/onboarding/services/onboarding.service";
import { __resetSlidingWindowRateLimitForTests } from "../../../shared/utils/sliding-window-rate-limit";

const mockUserFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockUserUpdate = jest.fn<(id: string, patch: Record<string, unknown>) => Promise<unknown>>();
const mockFindByOwner =
  jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus; owner?: string; website_url?: string }>>>();
const mockFindByUser = jest.fn<() => Promise<Array<{ _id: string; status: SiteStatus }>>>();
const mockSiteUpdate = jest.fn<() => Promise<unknown>>();
const mockFindById = jest.fn<() => Promise<Record<string, unknown> | null>>();
const mockFinalize = jest.fn<() => Promise<void>>();
const mockGetActiveSubscription = jest.fn<() => Promise<unknown>>();
const mockCreateFreeSubscription = jest.fn<() => Promise<void>>();
const mockDeriveProgress = jest.fn<() => Promise<StrategistProgress>>();
const mockBootstrapStart =
  jest.fn<() => Promise<{ progress: StrategistProgress; alreadyReady: boolean; accepted: boolean }>>();
const mockIsInflight = jest.fn<() => boolean>();

function ownerUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: "u1",
    email_verified: true,
    company_role: "founder",
    ...overrides,
  };
}

const pendingProgress: StrategistProgress = {
  site_id: "s1",
  ready: false,
  failed: false,
  steps: [
    { id: "content_strategy", label: "Content strategy being generated", status: "in_progress" },
    { id: "default_campaign", label: "Campaign being drafted", status: "pending" },
    { id: "campaign_topics", label: "Campaign topics being generated", status: "pending" },
  ],
};

const readyProgress: StrategistProgress = {
  site_id: "s1",
  ready: true,
  failed: false,
  steps: [
    { id: "content_strategy", label: "Content strategy being generated", status: "ready" },
    { id: "default_campaign", label: "Campaign being drafted", status: "ready" },
    { id: "campaign_topics", label: "Campaign topics being generated", status: "ready" },
  ],
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
      deriveProgress: mockDeriveProgress,
      start: mockBootstrapStart,
      isInflight: mockIsInflight,
    } as never
  );
}

describe("OnboardingService.getSignupWizardStatus", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInflight.mockReturnValue(false);
    mockDeriveProgress.mockResolvedValue(pendingProgress);
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

  it("returns strategist_setup after plan selection when a workspace exists", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: null,
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(pendingProgress);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
  });

  it("returns invite after strategist ready is acknowledged", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        strategist_ready_acknowledged_at: new Date(),
        workspace_invite_prompt_dismissed_at: null,
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(readyProgress);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.INVITE, site_id: "s1" });
  });

  it("returns strategist_setup after acknowledgement when generation is still running", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        strategist_ready_acknowledged_at: new Date(),
        workspace_invite_prompt_dismissed_at: null,
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(pendingProgress);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
  });

  it("stays on strategist_setup after acknowledgement when a new URL cannot be read", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        strategist_ready_acknowledged_at: new Date(),
        workspace_invite_prompt_dismissed_at: null,
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE, website_url: "https://bad.example" }]);
    mockDeriveProgress.mockResolvedValue({
      site_id: "s1",
      ready: false,
      failed: true,
      steps: [
        {
          id: "content_strategy",
          label: "Content strategy being generated",
          status: "failed",
          error: "Could not read that website. Check the URL and try again.",
        },
        { id: "default_campaign", label: "Campaign being drafted", status: "failed" },
        { id: "campaign_topics", label: "Campaign topics being generated", status: "failed" },
      ],
    });

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
  });

  it("returns strategist_ready when bootstrap is ready and not acknowledged", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(readyProgress);

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_READY, site_id: "s1" });
  });

  it("stays on strategist_setup when strategy ingest failed", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE, website_url: "https://bad.example" }]);
    mockDeriveProgress.mockResolvedValue({
      site_id: "s1",
      ready: false,
      failed: true,
      steps: [
        {
          id: "content_strategy",
          label: "Content strategy being generated",
          status: "failed",
          error: "Could not read that website. Check the URL and try again.",
        },
        { id: "default_campaign", label: "Campaign being drafted", status: "failed" },
        { id: "campaign_topics", label: "Campaign topics being generated", status: "failed" },
      ],
    });

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
  });

  it("returns strategist_setup when bootstrap failed for a non-URL reason", async () => {
    mockUserFindById.mockResolvedValue(
      ownerUser({
        plan_selection_completed_at: new Date(),
        workspace_invite_prompt_dismissed_at: new Date(),
      })
    );
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue({
      site_id: "s1",
      ready: false,
      failed: true,
      steps: [
        {
          id: "content_strategy",
          label: "Content strategy being generated",
          status: "failed",
          error: "Content strategy generation failed",
        },
        { id: "default_campaign", label: "Campaign being drafted", status: "failed" },
        { id: "campaign_topics", label: "Campaign topics being generated", status: "failed" },
      ],
    });

    const status = await service.getSignupWizardStatus("u1");

    expect(status).toEqual({ stage: SignupWizardStage.STRATEGIST_SETUP, site_id: "s1" });
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
    mockIsInflight.mockReturnValue(false);
    mockDeriveProgress.mockResolvedValue(pendingProgress);
    service = makeOnboardingService();
  });

  it("returns a snapshot without kicking topic generation", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1" });
    mockFindByUser.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);

    const progress = await service.getStrategistProgress("u1", "s1");

    expect(mockBootstrapStart).not.toHaveBeenCalled();
    expect(progress.ready).toBe(false);
  });

  it("rejects progress for users who are not workspace members", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u2" });
    mockFindByUser.mockResolvedValue([]);

    await expect(service.getStrategistProgress("u1", "s1")).rejects.toThrow(ForbiddenError);
    expect(mockDeriveProgress).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.startStrategistBootstrap", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetSlidingWindowRateLimitForTests();
    mockIsInflight.mockReturnValue(false);
    mockDeriveProgress.mockResolvedValue(pendingProgress);
    mockBootstrapStart.mockResolvedValue({ progress: pendingProgress, alreadyReady: false, accepted: true });
    service = makeOnboardingService();
  });

  it("starts the shared bootstrap pipeline", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://example.com" });

    const result = await service.startStrategistBootstrap("u1", "s1");

    expect(mockBootstrapStart).toHaveBeenCalledWith("s1", "u1", undefined);
    expect(result.accepted).toBe(true);
  });

  it("passes force through to the bootstrap pipeline", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://new.example" });

    await service.startStrategistBootstrap("u1", "s1", { force: true });

    expect(mockBootstrapStart).toHaveBeenCalledWith("s1", "u1", { force: true });
  });

  it("rejects start from anyone who is not the workspace owner", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u2", website_url: "https://example.com" });

    await expect(service.startStrategistBootstrap("u1", "s1")).rejects.toThrow(ForbiddenError);
    expect(mockBootstrapStart).not.toHaveBeenCalled();
  });

  it("rate-limits new bootstrap runs to five attempts per hour", async () => {
    mockFindById.mockResolvedValue({ _id: "s1", owner: "u1", website_url: "https://example.com" });

    for (let i = 0; i < 5; i += 1) {
      await service.startStrategistBootstrap("u1", "s1");
    }

    await expect(service.startStrategistBootstrap("u1", "s1")).rejects.toThrow(TooManyRequestsError);
    expect(mockBootstrapStart).toHaveBeenCalledTimes(5);
  });
});

describe("OnboardingService.acknowledgeStrategistReady", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInflight.mockReturnValue(false);
    mockDeriveProgress.mockResolvedValue(readyProgress);
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

  it("stamps acknowledgement and returns invite when teammates have not been prompted", async () => {
    const user = ownerUser({
      plan_selection_completed_at: new Date(),
    });
    mockUserFindById.mockImplementation(async () => user);
    mockUserUpdate.mockImplementation(async (_id, patch) => {
      Object.assign(user, patch);
      return user;
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(readyProgress);
    mockFinalize.mockResolvedValue(undefined);

    const status = await service.acknowledgeStrategistReady("u1");

    expect(mockUserUpdate).toHaveBeenCalled();
    expect(mockFinalize).not.toHaveBeenCalled();
    expect(status).toEqual({ stage: SignupWizardStage.INVITE, site_id: "s1" });
  });

  it("stamps acknowledgement and finalizes signup when invite was already dismissed", async () => {
    const user = ownerUser({
      plan_selection_completed_at: new Date(),
      workspace_invite_prompt_dismissed_at: new Date(),
    });
    mockUserFindById.mockImplementation(async () => user);
    mockUserUpdate.mockImplementation(async (_id, patch) => {
      Object.assign(user, patch);
      return user;
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(readyProgress);
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
    mockDeriveProgress.mockResolvedValue(pendingProgress);

    await expect(service.acknowledgeStrategistReady("u1", true)).rejects.toThrow(
      /Finish strategist setup before continuing/
    );
    expect(mockFinalize).not.toHaveBeenCalled();
  });
});

describe("OnboardingService.dismissInvitePrompt", () => {
  let service: OnboardingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInflight.mockReturnValue(false);
    mockDeriveProgress.mockResolvedValue(readyProgress);
    service = makeOnboardingService();
  });

  it("finalizes signup when strategist ready was already acknowledged", async () => {
    const user = ownerUser({
      plan_selection_completed_at: new Date(),
      strategist_ready_acknowledged_at: new Date(),
    });
    mockUserFindById.mockImplementation(async () => user);
    mockUserUpdate.mockImplementation(async (_id, patch) => {
      Object.assign(user, patch);
      return user;
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockFinalize.mockResolvedValue(undefined);

    await service.dismissInvitePrompt("u1");

    expect(mockFinalize).toHaveBeenCalledWith("u1");
  });

  it("does not finalize when strategist setup is still in progress", async () => {
    const user = ownerUser({
      plan_selection_completed_at: new Date(),
    });
    mockUserFindById.mockImplementation(async () => user);
    mockUserUpdate.mockImplementation(async (_id, patch) => {
      Object.assign(user, patch);
      return user;
    });
    mockFindByOwner.mockResolvedValue([{ _id: "s1", status: SiteStatus.ACTIVE }]);
    mockDeriveProgress.mockResolvedValue(pendingProgress);

    await service.dismissInvitePrompt("u1");

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
