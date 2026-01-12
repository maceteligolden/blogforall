import { Request, Response } from "express";
import { injectable, container } from "tsyringe";
import { SubscriptionRepository } from "../../subscription/repositories/subscription.repository";
import { PlanRepository } from "../../subscription/repositories/plan.repository";
import { SubscriptionStatus } from "../../../shared/schemas/subscription.schema";
import { SUBSCRIPTION_CONSTANTS } from "../../../shared/constants/subscription.constant";
import User from "../../../shared/schemas/user.schema";
import { logger } from "../../../shared/utils/logger";

const stripe = require("stripe")(process.env.STRIPE_API_KEY);

@injectable()
export class BillingWebhook {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      const rawBody = req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: any) {
      logger.error("Webhook signature verification failed", err, {}, "BillingWebhook");
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      const dataObject = event.data.object;

      switch (event.type) {
        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(dataObject);
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailed(dataObject);
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(dataObject);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(dataObject);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`, {}, "BillingWebhook");
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error("Error processing webhook", error, {}, "BillingWebhook");
      res.status(500).json({ error: error.message });
    }
  }

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${subscriptionId}`, {}, "BillingWebhook");
      return;
    }

    // Update subscription status to active
    await this.subscriptionRepository.update(subscription._id!, {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(invoice.period_start * 1000),
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      cancelAtPeriodEnd: false,
    });

    logger.info(`Payment succeeded for subscription ${subscriptionId}`, {}, "BillingWebhook");
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    const subscriptionId = invoice.subscription;
    if (!subscriptionId) return;

    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${subscriptionId}`, {}, "BillingWebhook");
      return;
    }

    // Set to past_due and add grace period
    const now = new Date();
    const gracePeriodEndsAt = new Date(now.getTime() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await this.subscriptionRepository.update(subscription._id!, {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt,
    });

    logger.info(`Payment failed for subscription ${subscriptionId}`, {}, "BillingWebhook");
  }

  private async handleSubscriptionUpdated(stripeSubscription: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${stripeSubscription.id}`, {}, "BillingWebhook");
      return;
    }

    // Get the price ID from Stripe subscription
    const priceId = stripeSubscription.items.data[0]?.price?.id;
    if (priceId) {
      const plan = await this.planRepository.findByStripePriceId(priceId);
      if (plan && plan._id !== subscription.planId) {
        // Plan changed - update subscription
        await this.subscriptionRepository.update(subscription._id!, {
          planId: plan._id!,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        });
      }
    }

    // Update status based on Stripe subscription status
    let status = SubscriptionStatus.ACTIVE;
    if (stripeSubscription.status === "canceled") {
      status = SubscriptionStatus.CANCELLED;
    } else if (stripeSubscription.status === "past_due") {
      status = SubscriptionStatus.PAST_DUE;
    } else if (stripeSubscription.status === "trialing") {
      status = SubscriptionStatus.TRIALING;
    }

    await this.subscriptionRepository.update(subscription._id!, {
      status,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    });

    logger.info(`Subscription updated: ${stripeSubscription.id}`, {}, "BillingWebhook");
  }

  private async handleSubscriptionDeleted(stripeSubscription: any): Promise<void> {
    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${stripeSubscription.id}`, {}, "BillingWebhook");
      return;
    }

    // Downgrade to free plan
    const plans = await this.planRepository.fetchActivePlans();
    const sortedPlans = plans.sort((a, b) => a.price - b.price);
    const freePlan = sortedPlans[0];

    const now = new Date();
    const TIME_IN_MS = SUBSCRIPTION_CONSTANTS.FREE_PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000;

    await this.subscriptionRepository.update(subscription._id!, {
      planId: freePlan._id!,
      status: SubscriptionStatus.FREE,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + TIME_IN_MS),
      providerSubscriptionId: undefined,
      paymentProvider: undefined,
      cancelAtPeriodEnd: false,
    });

    logger.info(`Subscription deleted and downgraded to free: ${stripeSubscription.id}`, {}, "BillingWebhook");
  }
}
