import { injectable } from "tsyringe";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { Subscription, SubscriptionStatus } from "../../../shared/schemas/subscription.schema";
import { Plan } from "../../../shared/schemas/plan.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { StripeFacade } from "../../../shared/facade/stripe.facade";
import { SUBSCRIPTION_CONSTANTS } from "../../../shared/constants/subscription.constant";
import User from "../../../shared/schemas/user.schema";
import { CardRepository } from "../../billing/repositories/card.repository";
import { isCardExpired } from "../../../shared/utils/card.util";

@injectable()
export class SubscriptionService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository,
    private stripeFacade: StripeFacade,
    private cardRepository: CardRepository
  ) {}

  /**
   * Get active subscription for user, creating free plan if none exists
   */
  async getActiveSubscription(userId: string): Promise<{ subscription: Subscription; plan: Plan }> {
    let subscription = await this.subscriptionRepository.findActiveByUserId(userId);

    if (!subscription) {
      subscription = await this.createFreeSubscription(userId);
    }

    // Check grace period
    const now = new Date();
    if (
      subscription.status === SubscriptionStatus.PAST_DUE &&
      subscription.gracePeriodEndsAt &&
      subscription.gracePeriodEndsAt < now
    ) {
      await this.downgradeToFree(subscription._id!);
      subscription = await this.subscriptionRepository.findActiveByUserId(userId);
    }

    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    const plan = await this.planRepository.findById(subscription.planId);
    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    return { subscription, plan };
  }

  /**
   * Create free subscription for new user
   */
  async createFreeSubscription(userId: string): Promise<Subscription> {
    const plans = await this.planRepository.fetchActivePlans();
    if (!plans || plans.length === 0) {
      throw new NotFoundError("No active plans found. Please create a plan first.");
    }

    const sortedPlans = plans.sort((a, b) => a.price - b.price);
    const defaultPlan = sortedPlans[0];

    const now = new Date();
    const TIME_IN_MS = SUBSCRIPTION_CONSTANTS.FREE_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000;

    return await this.subscriptionRepository.create({
      userId,
      planId: defaultPlan._id!,
      status: SubscriptionStatus.FREE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TIME_IN_MS),
      cancelAtPeriodEnd: false,
    });
  }

  /**
   * Downgrade subscription to free plan
   */
  async downgradeToFree(subscriptionId: string): Promise<void> {
    const plans = await this.planRepository.fetchActivePlans();
    if (!plans || plans.length === 0) {
      throw new NotFoundError("No active plans found.");
    }

    const sortedPlans = plans.sort((a, b) => a.price - b.price);
    const defaultPlan = sortedPlans[0];

    const now = new Date();
    const TIME_IN_MS = SUBSCRIPTION_CONSTANTS.FREE_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000;

    await this.subscriptionRepository.update(subscriptionId, {
      planId: defaultPlan._id!,
      status: SubscriptionStatus.FREE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TIME_IN_MS),
      gracePeriodEndsAt: undefined,
      providerSubscriptionId: undefined,
      paymentProvider: undefined,
    });
  }

  /**
   * Get all active plans
   */
  async getActivePlans(): Promise<Plan[]> {
    return await this.planRepository.fetchActivePlans();
  }

  /**
   * Change subscription plan
   */
  async changePlan(userId: string, newPlanId: string): Promise<Subscription> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    const newPlan = await this.planRepository.findById(newPlanId);
    if (!newPlan || !newPlan.isActive) {
      throw new NotFoundError("Plan not found or inactive");
    }

    if (subscription.planId === newPlanId) {
      throw new BadRequestError("You are already on this plan");
    }

    // If changing to free plan
    if (newPlan.interval === "free" || newPlan.price === 0) {
      return await this.downgradeToFreePlan(userId, subscription._id!);
    }

    // If current plan is free, need to create Stripe subscription
    if (subscription.status === SubscriptionStatus.FREE || !subscription.providerSubscriptionId) {
      if (!user.stripe_customer_id) {
        throw new BadRequestError("No payment method found. Please add a payment method first.");
      }

      // If plan doesn't have Stripe price ID, create it
      let stripePriceId = newPlan.stripe_price_id;
      if (!stripePriceId && newPlan.price > 0 && (newPlan.interval === "month" || newPlan.interval === "year")) {
        try {
          // Create product in Stripe
          const product = await this.stripeFacade.findOrCreateProduct(
            `BlogForAll ${newPlan.name}`,
            `BlogForAll ${newPlan.name} Plan`
          );

          // Create price in Stripe
          const price = await this.stripeFacade.createPrice(
            product.id,
            newPlan.price,
            newPlan.currency || "usd",
            newPlan.interval
          );

          stripePriceId = price.id;

          // Update plan with Stripe price ID
          await this.planRepository.update(newPlanId, { stripe_price_id: stripePriceId });
        } catch (error: any) {
          throw new BadRequestError(
            `Failed to configure plan for billing: ${error.message || "Please contact support"}`
          );
        }
      }

      if (!stripePriceId) {
        throw new BadRequestError("Plan is not configured for billing");
      }

      // Get user's default card and ensure it's set as default payment method
      const defaultCard = await this.cardRepository.findDefaultCard(user.stripe_customer_id);
      if (!defaultCard || !defaultCard.stripe_card_token) {
        throw new BadRequestError("No payment method found. Please add a payment method first.");
      }

      // Check if card is expired
      if (defaultCard.expire_date && isCardExpired(defaultCard.expire_date)) {
        throw new BadRequestError(
          "Your default payment method has expired. Please update your payment method before changing plans."
        );
      }

      // Ensure payment method is attached to customer
      try {
        await this.stripeFacade.attachPaymentMethod(user.stripe_customer_id, defaultCard.stripe_card_token);
      } catch (error: any) {
        // Payment method might already be attached, continue
        if (!error.message?.includes("already been attached")) {
          throw error;
        }
      }

      // Set as default payment method on customer
      await this.stripeFacade.setDefaultPaymentMethod(user.stripe_customer_id, defaultCard.stripe_card_token);

      // Create Stripe subscription with default payment method
      const stripeSubscription = await this.stripeFacade.createSubscription(
        user.stripe_customer_id,
        stripePriceId
      );

      // Update subscription
      const now = new Date();
      const updated = await this.subscriptionRepository.update(subscription._id!, {
        planId: newPlanId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        providerSubscriptionId: stripeSubscription.id,
        paymentProvider: "stripe",
        cancelAtPeriodEnd: false,
      });
      if (!updated) {
        throw new NotFoundError("Subscription not found");
      }
      return updated;
    }

    // Upgrading/downgrading existing paid subscription
    if (!subscription.providerSubscriptionId) {
      throw new BadRequestError("Cannot change plan for this subscription");
    }

    // If plan doesn't have Stripe price ID, create it
    let stripePriceId = newPlan.stripe_price_id;
    if (!stripePriceId && newPlan.price > 0 && (newPlan.interval === "month" || newPlan.interval === "year")) {
      try {
        // Create product in Stripe
        const product = await this.stripeFacade.findOrCreateProduct(
          `BlogForAll ${newPlan.name}`,
          `BlogForAll ${newPlan.name} Plan`
        );

        // Create price in Stripe
        const price = await this.stripeFacade.createPrice(
          product.id,
          newPlan.price,
          newPlan.currency || "usd",
          newPlan.interval
        );

        stripePriceId = price.id;

        // Update plan with Stripe price ID
        await this.planRepository.update(newPlanId, { stripe_price_id: stripePriceId });
      } catch (error: any) {
        throw new BadRequestError(
          `Failed to configure plan for billing: ${error.message || "Please contact support"}`
        );
      }
    }

    if (!stripePriceId) {
      throw new BadRequestError("Plan is not configured for billing");
    }

    // Update Stripe subscription
    await this.stripeFacade.updateSubscription(subscription.providerSubscriptionId, stripePriceId);

    // Update local subscription (plan change takes effect at next billing cycle)
    const updated = await this.subscriptionRepository.update(subscription._id!, {
      planId: newPlanId,
      cancelAtPeriodEnd: false,
    });
    if (!updated) {
      throw new NotFoundError("Subscription not found");
    }
    return updated;
  }

  /**
   * Cancel subscription (scheduled for end of period)
   */
  async cancelSubscription(userId: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new NotFoundError("Subscription not found");
    }

    if (subscription.status === SubscriptionStatus.FREE) {
      throw new BadRequestError("Cannot cancel free subscription");
    }

    if (subscription.providerSubscriptionId) {
      // Set cancel_at_period_end in Stripe (don't cancel immediately)
      await this.stripeFacade.setCancelAtPeriodEnd(subscription.providerSubscriptionId, true);
    }

    // Update to cancel at period end
    const updated = await this.subscriptionRepository.update(subscription._id!, {
      cancelAtPeriodEnd: true,
      // Don't change status to CANCELLED yet - it's still active until period end
    });
    if (!updated) {
      throw new NotFoundError("Subscription not found");
    }
    return updated;
  }

  /**
   * Update subscription payment method (called when default card changes)
   */
  async updateSubscriptionPaymentMethod(userId: string): Promise<void> {
    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription || !subscription.providerSubscriptionId) {
      // No active paid subscription, nothing to update
      return;
    }

    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      return;
    }

    // Get default card
    const defaultCard = await this.cardRepository.findDefaultCard(user.stripe_customer_id);
    if (!defaultCard || !defaultCard.stripe_card_token) {
      return;
    }

    // Update subscription's default payment method
    await this.stripeFacade.updateSubscriptionPaymentMethod(
      subscription.providerSubscriptionId,
      defaultCard.stripe_card_token
    );
  }

  /**
   * Downgrade to free plan
   */
  private async downgradeToFreePlan(userId: string, subscriptionId: string): Promise<Subscription> {
    const plans = await this.planRepository.fetchActivePlans();
    const sortedPlans = plans.sort((a, b) => a.price - b.price);
    const freePlan = sortedPlans[0];

    // Cancel Stripe subscription if exists
    const subscription = await this.subscriptionRepository.findById(subscriptionId);
    if (subscription?.providerSubscriptionId) {
      try {
        await this.stripeFacade.cancelSubscription(subscription.providerSubscriptionId);
      } catch (error) {
        // Ignore errors if subscription already cancelled
      }
    }

    const now = new Date();
    const TIME_IN_MS = SUBSCRIPTION_CONSTANTS.FREE_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000;

    const updated = await this.subscriptionRepository.update(subscriptionId, {
      planId: freePlan._id!,
      status: SubscriptionStatus.FREE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TIME_IN_MS),
      cancelAtPeriodEnd: false,
      providerSubscriptionId: undefined,
      paymentProvider: undefined,
    });
    if (!updated) {
      throw new NotFoundError("Subscription not found");
    }
    return updated;
  }
}
