import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { SiteRepository } from "../../site/repositories/site.repository";
import { AuthService } from "../../auth/services/auth.service";
import { NotFoundError, BadRequestError, ForbiddenError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { captureServerEvent, ServerAnalyticsEvents } from "../../../shared/analytics/posthog.server";
import { SignupWizardStage, SiteStatus } from "../../../shared/constants";
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

const SETUP_ITEMS: Array<{ id: string; label: string; check: (m: Record<string, unknown> | null) => boolean }> = [
  {
    id: "business_type",
    label: "What your business does",
    check: (m) => Boolean((m?.strategic as { business_type?: string } | undefined)?.business_type?.trim()),
  },
  {
    id: "target_audience",
    label: "Who you write for",
    check: (m) => {
      const aud = (m?.strategic as { target_audience?: string[] } | undefined)?.target_audience;
      return Array.isArray(aud) && aud.length > 0;
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
      // New owner path: role before naming workspace.
      if (!user.company_role) {
        return { stage: SignupWizardStage.COMPANY_ROLE };
      }
      return { stage: SignupWizardStage.WORKSPACE_NAME };
    }

    // Legacy: promote stuck ONBOARDING sites to ACTIVE (chatless signup).
    for (const site of ownedSites) {
      if (site.status === SiteStatus.ONBOARDING) {
        await this.siteRepository.update(site._id!.toString(), { status: SiteStatus.ACTIVE });
        site.status = SiteStatus.ACTIVE;
        logger.info("Migrated onboarding site to active", { siteId: site._id, userId }, "OnboardingService");
      }
    }

    const primarySiteId = ownedSites[0]?._id?.toString();

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

  async getSetupProgress(userId: string, siteId: string): Promise<SetupProgress> {
    const hasAccess = await this.siteRepository.findById(siteId);
    if (!hasAccess) throw new NotFoundError("Workspace not found");

    const memberSites = await this.siteRepository.findByUser(userId);
    if (!memberSites.some((s) => s._id!.toString() === siteId)) {
      throw new ForbiddenError("You do not have access to this workspace");
    }

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

    const wasComplete = Boolean(user.workspace_invite_prompt_dismissed_at);

    await User.findByIdAndUpdate(userId, {
      workspace_invite_prompt_dismissed_at: new Date(),
      updated_at: new Date(),
    });

    logger.info("Workspace invite prompt dismissed", { userId }, "OnboardingService");

    // First time completing the wizard → welcome email + USER_SIGNED_UP
    if (!wasComplete) {
      try {
        await this.authService.finalizeSignupCompletion(userId);
      } catch (error) {
        logger.error(
          "Failed to finalize signup completion after invite dismiss",
          error as Error,
          { userId },
          "OnboardingService",
        );
      }
    }
  }
}
