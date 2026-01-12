import { injectable } from "tsyringe";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { Subscription, SubscriptionStatus } from "../../../shared/schemas/subscription.schema";
import { Plan } from "../../../shared/schemas/plan.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { StripeFacade } from "../../../shared/facade/stripe.facade";
import { SUBSCRIPTION_CONSTANTS } from "../../../shared/constants/subscription.constant";
import User from "../../../shared/schemas/user.schema";

@injectable()
export class SubscriptionService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository,
    private stripeFacade: StripeFacade
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

      if (!newPlan.stripe_price_id) {
        throw new BadRequestError("Plan is not configured for billing");
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripeFacade.createSubscription(
        user.stripe_customer_id,
        newPlan.stripe_price_id
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

    if (!newPlan.stripe_price_id) {
      throw new BadRequestError("Plan is not configured for billing");
    }

    // Update Stripe subscription
    await this.stripeFacade.updateSubscription(subscription.providerSubscriptionId, newPlan.stripe_price_id);

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
      // Cancel in Stripe
      await this.stripeFacade.cancelSubscription(subscription.providerSubscriptionId);
    }

    // Update to cancel at period end
    const updated = await this.subscriptionRepository.update(subscription._id!, {
      cancelAtPeriodEnd: true,
      status: SubscriptionStatus.CANCELLED,
    });
    if (!updated) {
      throw new NotFoundError("Subscription not found");
    }
    return updated;
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
