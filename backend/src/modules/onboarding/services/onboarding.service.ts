import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { SiteRepository } from "../../site/repositories/site.repository";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { captureServerEvent, ServerAnalyticsEvents } from "../../../shared/analytics/posthog.server";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";

export type SignupWizardStatus = {
  stage: SignupWizardStage;
  site_id?: string;
};

@injectable()
export class OnboardingService {
  constructor(
    private subscriptionService: SubscriptionService,
    private siteRepository: SiteRepository
  ) {}

  async getOnboardingStatus(userId: string): Promise<{
    requiresOnboarding: boolean;
    hasCard: boolean;
    hasPlan: boolean;
  }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    let hasPlan = false;
    try {
      await this.subscriptionService.getActiveSubscription(userId);
      hasPlan = true;
    } catch {
      hasPlan = false;
    }

    return {
      requiresOnboarding: !user.onboarding_completed,
      hasCard: false,
      hasPlan,
    };
  }

  /**
   * Resolve the current owner signup wizard stage from sites and user fields.
   */
  async getSignupWizardStatus(userId: string): Promise<SignupWizardStatus> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const ownedSites = await this.siteRepository.findByOwner(userId);

    if (ownedSites.length === 0) {
      const accessibleSites = await this.siteRepository.findByUser(userId);
      if (accessibleSites.length > 0) {
        return { stage: SignupWizardStage.COMPLETE };
      }
      return { stage: SignupWizardStage.WORKSPACE_NAME };
    }

    const onboardingSite = ownedSites.find((s) => s.status === SiteStatus.ONBOARDING);
    if (onboardingSite) {
      return {
        stage: SignupWizardStage.BUSINESS_CHAT,
        site_id: onboardingSite._id!.toString(),
      };
    }

    const activeOwned = ownedSites.filter((s) => s.status === SiteStatus.ACTIVE);
    const primarySiteId = activeOwned[0]?._id?.toString();

    if (!user.plan_selection_completed_at) {
      return {
        stage: SignupWizardStage.PLAN_SELECTION,
        site_id: primarySiteId,
      };
    }

    if (!user.workspace_invite_prompt_dismissed_at) {
      return {
        stage: SignupWizardStage.INVITE,
        site_id: primarySiteId,
      };
    }

    return { stage: SignupWizardStage.COMPLETE, site_id: primarySiteId };
  }

  /**
   * Ensures free subscription and marks account onboarding complete (idempotent).
   */
  async ensureFreePlanAndCompleteOnboarding(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    try {
      await this.subscriptionService.getActiveSubscription(userId);
    } catch {
      await this.subscriptionService.createFreeSubscription(userId);
    }

    const { plan } = await this.subscriptionService.getActiveSubscription(userId);
    if (plan.price > 0 && plan.interval !== "free") {
      const freePlan = await this.subscriptionService.getFreePlan();
      await this.subscriptionService.changePlan(userId, freePlan._id!);
    }

    if (!user.onboarding_completed) {
      await User.findByIdAndUpdate(userId, {
        onboarding_completed: true,
        updated_at: new Date(),
      });
      logger.info("User onboarding marked complete (free plan)", { userId }, "OnboardingService");
      captureServerEvent(ServerAnalyticsEvents.USER_ONBOARDING_COMPLETED, {
        userId,
        properties: { free_only: true },
      });
    }
  }

  /**
   * User confirmed plan selection during signup wizard (free plan only for now).
   */
  async completePlanSelection(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await this.ensureFreePlanAndCompleteOnboarding(userId);

    if (!user.plan_selection_completed_at) {
      await User.findByIdAndUpdate(userId, {
        plan_selection_completed_at: new Date(),
        updated_at: new Date(),
      });
      logger.info("Signup wizard plan selection completed", { userId }, "OnboardingService");
    }
  }

  async completeOnboarding(_userId: string, _planId: string, _paymentMethodId: string): Promise<void> {
    throw new BadRequestError("Plan selection is disabled. All accounts use the free plan.");
  }

  async skipOnboarding(userId: string): Promise<void> {
    await this.ensureFreePlanAndCompleteOnboarding(userId);
    logger.info("User onboarding ensured (free plan)", { userId }, "OnboardingService");
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

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const ownedSites = await this.siteRepository.findByOwner(userId);
    const activeOwned = ownedSites.filter((s) => s.status === SiteStatus.ACTIVE);

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
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await User.findByIdAndUpdate(userId, {
      workspace_invite_prompt_dismissed_at: new Date(),
      updated_at: new Date(),
    });

    logger.info("Workspace invite prompt dismissed", { userId }, "OnboardingService");
  }
}
