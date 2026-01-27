import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { BillingService } from "../../billing/services/billing.service";
import { CardRepository } from "../../billing/repositories/card.repository";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";

@injectable()
export class OnboardingService {
  constructor(
    private subscriptionService: SubscriptionService,
    private billingService: BillingService,
    private cardRepository: CardRepository
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

    // Check if user has a card
    let hasCard = false;
    if (user.stripe_customer_id) {
      const cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
      hasCard = cards.length > 0;
    }

    // Check if user has an active paid subscription (not free)
    let hasPlan = false;
    try {
      const { subscription, plan } = await this.subscriptionService.getActiveSubscription(userId);
      hasPlan = plan.price > 0 && subscription.status !== "free";
    } catch (error) {
      // No subscription yet
      hasPlan = false;
    }

    return {
      requiresOnboarding: !user.onboarding_completed,
      hasCard,
      hasPlan,
    };
  }

  async completeOnboarding(userId: string, planId: string, paymentMethodId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (!user.stripe_customer_id) {
      throw new BadRequestError("Stripe customer not found. Please contact support.");
    }

    // 1. Confirm and save the payment method
    await this.billingService.confirmCard(userId, paymentMethodId);

    // 2. Set as default payment method
    const cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
    const card = cards.find((c) => c.stripe_card_token === paymentMethodId);
    if (card) {
      await this.billingService.setDefaultCard(card._id!, userId);
    }

    // 3. Ensure user has a subscription (create free one if doesn't exist)
    try {
      await this.subscriptionService.getActiveSubscription(userId);
    } catch (error) {
      // No subscription exists, create a free one first
      await this.subscriptionService.createFreeSubscription(userId);
    }

    // 4. Subscribe to the selected plan
    await this.subscriptionService.changePlan(userId, planId);

    // 5. Mark onboarding as completed
    await User.findByIdAndUpdate(userId, {
      onboarding_completed: true,
      updated_at: new Date(),
    });

    logger.info("User completed onboarding", { userId, planId }, "OnboardingService");
  }

  async skipOnboarding(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // 1. Ensure user has a subscription (create free one if doesn't exist)
    let hasSubscription = false;
    try {
      await this.subscriptionService.getActiveSubscription(userId);
      hasSubscription = true;
    } catch (error) {
      // No subscription exists, create a free one
      await this.subscriptionService.createFreeSubscription(userId);
      hasSubscription = true;
    }

    // 2. Ensure user is on free plan (if not already)
    if (hasSubscription) {
      try {
        const { subscription, plan } = await this.subscriptionService.getActiveSubscription(userId);
        if (plan.price > 0 || plan.interval !== "free") {
          // User is on a paid plan, downgrade to free
          const plans = await this.subscriptionService.getActivePlans();
          const freePlan = plans.find(p => p.price === 0 || p.interval === "free");
          if (freePlan) {
            await this.subscriptionService.changePlan(userId, freePlan._id!);
          }
        }
      } catch (error) {
        // Error getting subscription, but we already created one above
        logger.error("Error ensuring free plan", error as Error, { userId }, "OnboardingService");
      }
    }

    // 3. Mark onboarding as completed
    await User.findByIdAndUpdate(userId, {
      onboarding_completed: true,
      updated_at: new Date(),
    });

    logger.info("User skipped onboarding", { userId }, "OnboardingService");
  }
}
