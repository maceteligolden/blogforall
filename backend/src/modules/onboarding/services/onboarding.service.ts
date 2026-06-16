import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { captureServerEvent, ServerAnalyticsEvents } from "../../../shared/analytics/posthog.server";

@injectable()
export class OnboardingService {
  constructor(private subscriptionService: SubscriptionService) {}

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

  async completeOnboarding(_userId: string, _planId: string, _paymentMethodId: string): Promise<void> {
    throw new BadRequestError("Plan selection is disabled. All accounts use the free plan.");
  }

  async skipOnboarding(userId: string): Promise<void> {
    await this.ensureFreePlanAndCompleteOnboarding(userId);
    logger.info("User onboarding ensured (free plan)", { userId }, "OnboardingService");
  }
}
