import { injectable } from "tsyringe";
import { UserRepository } from "../../auth/repositories/user.repository";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { BillingService } from "../../billing/services/billing.service";
import { CardRepository } from "../../billing/repositories/card.repository";
import { SiteRepository } from "../../site/repositories/site.repository";
import { AuthService } from "../../auth/services/auth.service";
import { WorkspaceStrategyService } from "../../strategic-intelligence/services/workspace-strategy.service";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../../campaign/repositories/campaign-roadmap.repository";
import { CampaignPlanningService } from "../../campaign/services/campaign-planning.service";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";
import { CampaignRoadmapStatus } from "../../../shared/constants/campaign.constant";
import { env } from "../../../shared/config/env";
import { isContentStrategyReady } from "../../../shared/types/content-strategy.document";
import { assertSlidingWindowRateLimit } from "../../../shared/utils/sliding-window-rate-limit";
import WorkspaceMemory from "../../../shared/schemas/workspace-memory.schema";

export type SignupWizardStatus = {
  stage: SignupWizardStage;
  site_id?: string;
};

export type SetupProgressItem = {
  id: string;
  label: string;
  done: boolean;
};

export type SetupProgress = {
  items: SetupProgressItem[];
  percent: number;
  complete: boolean;
};

export type StrategistStepStatus = "pending" | "in_progress" | "ready" | "failed";

export type StrategistProgressStep = {
  id: "content_strategy" | "default_campaign" | "campaign_topics";
  label: string;
  status: StrategistStepStatus;
  error?: string;
};

export type StrategistProgress = {
  site_id: string;
  steps: StrategistProgressStep[];
  ready: boolean;
  failed: boolean;
};

const SETUP_ITEMS: Array<{ id: string; label: string; check: (m: Record<string, unknown> | null) => boolean }> = [
  {
    id: "business_description",
    label: "What your business does",
    check: (m) => {
      const s = m?.strategic as { business_description?: string; business_type?: string } | undefined;
      return Boolean(s?.business_description?.trim() || s?.business_type?.trim());
    },
  },
  {
    id: "customers",
    label: "Who you write for",
    check: (m) => {
      const s = m?.strategic as { customers?: Array<{ who?: string }>; target_audience?: string[] } | undefined;
      const hasCustomers = Array.isArray(s?.customers) && s.customers.some((c) => !!c?.who?.trim());
      const hasLabels = Array.isArray(s?.target_audience) && s.target_audience.length > 0;
      return hasCustomers || hasLabels;
    },
  },
  {
    id: "brand_voice",
    label: "Brand voice",
    check: (m) => Boolean((m?.strategic as { brand_voice?: string } | undefined)?.brand_voice?.trim()),
  },
  {
    id: "business_goals",
    label: "Business goals",
    check: (m) => {
      const goals = (m?.strategic as { business_goals?: string[] } | undefined)?.business_goals;
      return Array.isArray(goals) && goals.length > 0;
    },
  },
  {
    id: "publishing_channels",
    label: "Where you publish",
    check: (m) => {
      const ch = (m?.strategic as { publishing_channels?: string[] } | undefined)?.publishing_channels;
      return Array.isArray(ch) && ch.length > 0;
    },
  },
];

@injectable()
export class OnboardingService {
  constructor(
    private subscriptionService: SubscriptionService,
    private siteRepository: SiteRepository,
    private authService: AuthService,
    private billingService: BillingService,
    private cardRepository: CardRepository,
    private userRepository: UserRepository,
    private workspaceStrategyService: WorkspaceStrategyService,
    private campaignRepository: CampaignRepository,
    private campaignRoadmapRepository: CampaignRoadmapRepository,
    private campaignPlanningService: CampaignPlanningService
  ) {}

  async getOnboardingStatus(userId: string): Promise<{
    requiresOnboarding: boolean;
    hasCard: boolean;
    hasPlan: boolean;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    let hasCard = false;
    if (user.stripe_customer_id) {
      const cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
      hasCard = cards.length > 0;
    }

    let hasPlan = false;
    try {
      const { plan, subscription } = await this.subscriptionService.getActiveSubscription(userId);
      hasPlan = plan.price > 0 && subscription.status !== "free";
    } catch {
      hasPlan = false;
    }

    return {
      requiresOnboarding: !user.onboarding_completed,
      hasCard,
      hasPlan,
    };
  }

  /**
   * Resolve the current owner signup wizard stage from sites and user fields.
   * Read-only aside from promoting legacy ONBOARDING sites to ACTIVE.
   */
  async getSignupWizardStatus(userId: string): Promise<SignupWizardStatus> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // New signups set email_verified: false until OTP; legacy docs omit the field → treat as verified.
    if (user.email_verified === false) {
      return { stage: SignupWizardStage.EMAIL_VERIFICATION };
    }

    const ownedSites = await this.siteRepository.findByOwner(userId);

    if (ownedSites.length === 0) {
      const accessibleSites = await this.siteRepository.findByUser(userId);
      // Invited members with workspace access skip the owner signup wizard.
      if (accessibleSites.length > 0) {
        return { stage: SignupWizardStage.COMPLETE };
      }
      if (!user.company_role) {
        return { stage: SignupWizardStage.COMPANY_ROLE };
      }
      if (!user.plan_selection_completed_at) {
        return { stage: SignupWizardStage.PLAN_SELECTION };
      }
      return { stage: SignupWizardStage.WORKSPACE_NAME };
    }

    for (const site of ownedSites) {
      if (site.status === SiteStatus.ONBOARDING) {
        await this.siteRepository.update(site._id!.toString(), { status: SiteStatus.ACTIVE });
        site.status = SiteStatus.ACTIVE;
        logger.info("Migrated onboarding site to active", { siteId: site._id, userId }, "OnboardingService");
      }
    }

    const primarySiteId = ownedSites[0]?._id?.toString();

    if (!user.company_role) {
      return { stage: SignupWizardStage.COMPANY_ROLE, site_id: primarySiteId };
    }
    if (!user.plan_selection_completed_at) {
      return { stage: SignupWizardStage.PLAN_SELECTION, site_id: primarySiteId };
    }
    if (!user.workspace_invite_prompt_dismissed_at) {
      return { stage: SignupWizardStage.INVITE, site_id: primarySiteId };
    }
    if (!user.strategist_ready_acknowledged_at) {
      const progress = primarySiteId ? await this.deriveStrategistProgress(primarySiteId, userId) : null;
      if (progress?.ready) {
        return { stage: SignupWizardStage.STRATEGIST_READY, site_id: primarySiteId };
      }
      return { stage: SignupWizardStage.STRATEGIST_SETUP, site_id: primarySiteId };
    }

    return { stage: SignupWizardStage.COMPLETE, site_id: primarySiteId };
  }

  async getSetupProgress(userId: string, siteId: string): Promise<SetupProgress> {
    await this.assertSiteMember(userId, siteId);

    const memory = await WorkspaceMemory.findOne({ site_id: siteId }).lean();
    const mem = (memory ?? null) as Record<string, unknown> | null;
    const items = SETUP_ITEMS.map(({ id, label, check }) => ({
      id,
      label,
      done: check(mem),
    }));
    const doneCount = items.filter((i) => i.done).length;
    const percent = Math.round((doneCount / items.length) * 100);
    return {
      items,
      percent,
      complete: doneCount === items.length,
    };
  }

  async getStrategistProgress(userId: string, siteId: string): Promise<StrategistProgress> {
    await this.assertSiteMember(userId, siteId);
    const progress = await this.deriveStrategistProgress(siteId, userId);
    if (progress.failed) {
      logger.warn(
        "Signup strategist bootstrap has a failed step",
        { userId, siteId, steps: progress.steps.map((s) => ({ id: s.id, status: s.status })) },
        "OnboardingService"
      );
    }
    return progress;
  }

  async retryStrategistProgress(userId: string, siteId: string): Promise<StrategistProgress> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) throw new NotFoundError("Workspace not found");
    if (site.owner !== userId) {
      throw new ForbiddenError("Only the workspace owner can retry strategist setup");
    }

    assertSlidingWindowRateLimit(`strategist-retry:${userId}`, {
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: "Too many retry attempts. Please wait before trying again.",
    });

    const strategy = await this.workspaceStrategyService.getActive(siteId).catch(() => null);
    let strategyReady = false;
    try {
      strategyReady = Boolean(strategy && isContentStrategyReady(strategy.generation_status, strategy.document));
    } catch {
      strategyReady = false;
    }

    if (!strategyReady) {
      const websiteUrl = site.website_url;
      await this.workspaceStrategyService.createGeneratingStub(siteId, userId, websiteUrl);
      this.workspaceStrategyService.startBackgroundGenerate(siteId, userId, websiteUrl);
      logger.info("Signup strategist bootstrap retry started", { userId, siteId }, "OnboardingService");
    } else {
      await this.campaignPlanningService.ensureDefaultRoadmap(siteId, userId);
      logger.info("Signup campaign topics retry started", { userId, siteId }, "OnboardingService");
    }
    return this.deriveStrategistProgress(siteId, userId);
  }

  async acknowledgeStrategistReady(userId: string, degraded = false): Promise<SignupWizardStatus> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const wizard = await this.getSignupWizardStatus(userId);
    if (wizard.stage !== SignupWizardStage.STRATEGIST_READY && wizard.stage !== SignupWizardStage.COMPLETE) {
      throw new BadRequestError("Finish strategist setup before continuing");
    }

    const wasAcknowledged = Boolean(user.strategist_ready_acknowledged_at);
    if (!wasAcknowledged) {
      await this.userRepository.update(userId, {
        strategist_ready_acknowledged_at: new Date(),
        updated_at: new Date(),
      });
      logger.info(
        "Signup strategist ready acknowledged",
        { userId, siteId: wizard.site_id, degraded },
        "OnboardingService"
      );
      try {
        await this.authService.finalizeSignupCompletion(userId);
      } catch (error) {
        logger.error(
          "Failed to finalize signup completion after strategist ready",
          error as Error,
          { userId },
          "OnboardingService"
        );
      }
    }

    return { stage: SignupWizardStage.COMPLETE, site_id: wizard.site_id };
  }

  /**
   * User confirmed free plan during signup wizard.
   */
  async completePlanSelection(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    if (user.email_verified === false) {
      throw new BadRequestError("Please verify your email before continuing.");
    }
    if (!user.company_role) {
      throw new BadRequestError("Please choose your workspace role before selecting a plan.");
    }

    await this.ensureFreeSubscriptionExists(userId);

    if (!user.plan_selection_completed_at) {
      await this.userRepository.update(userId, {
        plan_selection_completed_at: new Date(),
        updated_at: new Date(),
      });
      logger.info("Signup wizard plan selection completed", { userId }, "OnboardingService");
    }
  }

  /**
   * Complete onboarding with a paid plan and payment method.
   */
  async completeOnboarding(userId: string, planId: string, paymentMethodId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    if (user.email_verified === false) {
      throw new BadRequestError("Please verify your email before continuing.");
    }
    if (!user.company_role) {
      throw new BadRequestError("Please choose your workspace role before selecting a plan.");
    }

    if (!user.stripe_customer_id) {
      throw new BadRequestError("Stripe customer not found. Please contact support.");
    }

    const allPlans = await this.subscriptionService.getActivePlans();
    const selected = allPlans.find((p) => p._id?.toString() === planId);
    if (!selected || !selected.isActive) {
      throw new NotFoundError("Plan not found or inactive");
    }

    if (selected.price === 0 || selected.interval === "free") {
      await this.completePlanSelection(userId);
      return;
    }

    // Card may already be saved (e.g. AddCardDialog confirmed it client-side).
    let cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
    let card = cards.find((c) => c.stripe_card_token === paymentMethodId);
    if (!card) {
      await this.billingService.confirmCard(userId, paymentMethodId);
      cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
      card = cards.find((c) => c.stripe_card_token === paymentMethodId);
    }
    if (card?._id) {
      await this.billingService.setDefaultCard(card._id, userId);
    }

    await this.ensureFreeSubscriptionExists(userId);

    await this.subscriptionService.changePlan(userId, planId);

    await this.userRepository.update(userId, {
      plan_selection_completed_at: user.plan_selection_completed_at ?? new Date(),
      updated_at: new Date(),
    });

    logger.info("Signup wizard paid plan selected", { userId, planId }, "OnboardingService");
  }

  async skipOnboarding(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await this.ensureFreeSubscriptionExists(userId);
    logger.info("Signup skip requested; wizard stages were not marked complete", { userId }, "OnboardingService");
  }

  /**
   * Whether to show the optional "invite teammates" step after workspace setup.
   */
  async getInvitePromptStatus(
    userId: string,
    preferredSiteId?: string
  ): Promise<{ should_show: boolean; site_id?: string }> {
    const wizard = await this.getSignupWizardStatus(userId);
    if (wizard.stage !== SignupWizardStage.INVITE) {
      return { should_show: false };
    }

    const ownedSites = await this.siteRepository.findByOwner(userId);
    const activeOwned = ownedSites.filter((s) => s.status === SiteStatus.ACTIVE || s.status === SiteStatus.ONBOARDING);

    if (activeOwned.length === 0) {
      return { should_show: false };
    }

    if (preferredSiteId) {
      const match = activeOwned.find((s) => s._id!.toString() === preferredSiteId);
      if (match) {
        return { should_show: true, site_id: match._id!.toString() };
      }
      throw new ForbiddenError("You can only invite teammates to workspaces you own");
    }

    return { should_show: true, site_id: wizard.site_id ?? activeOwned[0]._id!.toString() };
  }

  async dismissInvitePrompt(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.workspace_invite_prompt_dismissed_at) {
      await this.userRepository.update(userId, {
        workspace_invite_prompt_dismissed_at: new Date(),
        updated_at: new Date(),
      });
      logger.info("Workspace invite prompt dismissed", { userId }, "OnboardingService");
    }
  }

  private async ensureFreeSubscriptionExists(userId: string): Promise<void> {
    try {
      await this.subscriptionService.getActiveSubscription(userId);
    } catch {
      await this.subscriptionService.createFreeSubscription(userId);
    }
  }

  private async assertSiteMember(userId: string, siteId: string): Promise<void> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) throw new NotFoundError("Workspace not found");

    const memberSites = await this.siteRepository.findByUser(userId);
    if (!memberSites.some((s) => s._id!.toString() === siteId)) {
      throw new ForbiddenError("You do not have access to this workspace");
    }
  }

  private async deriveStrategistProgress(siteId: string, userId?: string): Promise<StrategistProgress> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      return {
        site_id: siteId,
        ready: true,
        failed: false,
        steps: [
          { id: "content_strategy", label: "Content strategy being generated", status: "ready" },
          { id: "default_campaign", label: "Campaign being drafted", status: "ready" },
          { id: "campaign_topics", label: "Campaign topics being generated", status: "ready" },
        ],
      };
    }

    const strategy = await this.workspaceStrategyService.getActive(siteId).catch((err) => {
      logger.warn(
        "Could not load content strategy for signup progress",
        { siteId, error: err instanceof Error ? err.message : String(err) },
        "OnboardingService"
      );
      return null;
    });

    let strategyStatus: StrategistStepStatus = "pending";
    let strategyError: string | undefined;
    const strategyReady = (() => {
      try {
        return Boolean(strategy && isContentStrategyReady(strategy.generation_status, strategy.document));
      } catch {
        return false;
      }
    })();
    if (!strategy) {
      strategyStatus = "pending";
    } else if (strategyReady) {
      strategyStatus = "ready";
    } else if (strategy.generation_status === "generating") {
      strategyStatus = "in_progress";
    } else if (strategy.generation_status === "failed") {
      strategyStatus = "failed";
      strategyError = strategy.generation_error || "Content strategy generation failed";
    }

    const campaign = await this.campaignRepository.findDefault(siteId).catch(() => null);
    const campaignStatus: StrategistStepStatus = campaign?._id ? "ready" : "pending";

    let topicsStatus: StrategistStepStatus = "pending";
    if (campaignStatus !== "ready") {
      topicsStatus = "pending";
    } else if (strategyStatus === "failed") {
      topicsStatus = "failed";
    } else if (strategyStatus !== "ready") {
      topicsStatus = strategyStatus === "in_progress" ? "pending" : "pending";
    } else {
      const campaignId = campaign!._id!.toString();
      const roadmap = await this.campaignRoadmapRepository.findLatest(campaignId, siteId).catch(() => null);
      const hasTopics = Array.isArray(roadmap?.items) && roadmap.items.length > 0;
      if (
        hasTopics &&
        (roadmap?.status === CampaignRoadmapStatus.APPROVED || roadmap?.status === CampaignRoadmapStatus.PROPOSED)
      ) {
        topicsStatus = "ready";
      } else if (roadmap) {
        topicsStatus = "in_progress";
      } else {
        topicsStatus = "in_progress";
        if (userId) {
          void this.campaignPlanningService.ensureDefaultRoadmap(siteId, userId).catch((err) => {
            logger.warn(
              "Signup campaign topics bootstrap failed to start",
              { siteId, error: err instanceof Error ? err.message : String(err) },
              "OnboardingService"
            );
          });
        }
      }
    }

    const steps: StrategistProgressStep[] = [
      {
        id: "content_strategy",
        label: "Content strategy being generated",
        status: strategyStatus,
        error: strategyError,
      },
      { id: "default_campaign", label: "Campaign being drafted", status: campaignStatus },
      { id: "campaign_topics", label: "Campaign topics being generated", status: topicsStatus },
    ];
    const ready = steps.every((s) => s.status === "ready");
    const failed = steps.some((s) => s.status === "failed");

    return { site_id: siteId, steps, ready, failed };
  }
}
