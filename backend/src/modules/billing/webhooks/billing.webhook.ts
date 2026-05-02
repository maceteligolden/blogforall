import { Request, Response } from "express";
import { injectable } from "tsyringe";
import Stripe from "stripe";
import { SubscriptionRepository } from "../../subscription/repositories/subscription.repository";
import { PlanRepository } from "../../subscription/repositories/plan.repository";
import { Subscription, SubscriptionStatus } from "../../../shared/schemas/subscription.schema";
import { SUBSCRIPTION_CONSTANTS } from "../../../shared/constants/subscription.constant";
import { logger } from "../../../shared/utils/logger";
import { env } from "../../../shared/config/env";

@injectable()
export class BillingWebhook {
  private stripe: Stripe;

  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private planRepository: PlanRepository
  ) {
    const apiKey = env.stripe.apiKey;
    if (!apiKey) {
      throw new Error("STRIPE_API_KEY environment variable is not set");
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: "2023-10-16",
    });
  }

  async handleWebhook(req: Request, res: Response): Promise<void> {
    const endpointSecret = env.stripe.webhookSecret;
    const sig = req.headers["stripe-signature"];

    if (!endpointSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET is not set", new Error("Missing webhook secret"), {}, "BillingWebhook");
      res.status(500).send("Webhook secret not configured");
      return;
    }

    if (!sig) {
      logger.error("Stripe signature header is missing", new Error("Missing signature"), {}, "BillingWebhook");
      res.status(400).send("Missing stripe-signature header");
      return;
    }

    let event: Stripe.Event;

    try {
      const rawBody = req.body;
      event = this.stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        "Webhook signature verification failed",
        err instanceof Error ? err : new Error(message),
        {},
        "BillingWebhook"
      );
      res.status(400).send(`Webhook Error: ${message}`);
      return;
    }

    try {
      const dataObject = event.data.object;

      switch (event.type) {
        case "invoice.payment_succeeded":
          await this.handlePaymentSucceeded(dataObject as Stripe.Invoice);
          break;

        case "invoice.payment_failed":
          await this.handlePaymentFailed(dataObject as Stripe.Invoice);
          break;

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(dataObject as Stripe.Subscription);
          break;

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(dataObject as Stripe.Subscription);
          break;

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`, {}, "BillingWebhook");
      }

      res.status(200).json({ received: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        "Error processing webhook",
        error instanceof Error ? error : new Error(message),
        {},
        "BillingWebhook"
      );
      res.status(500).json({ error: message });
    }
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) return;

    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${subscriptionId}`, {}, "BillingWebhook");
      return;
    }

    const updateData: Partial<Subscription> = {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date((invoice.period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((invoice.period_end ?? 0) * 1000),
      cancelAtPeriodEnd: false,
    };

    if (subscription.pendingPlanId) {
      updateData.planId = subscription.pendingPlanId;
      updateData.pendingPlanId = undefined;
      logger.info(`Applied pending plan change for subscription ${subscriptionId}`, {}, "BillingWebhook");
    }

    await this.subscriptionRepository.update(subscription._id!, updateData);

    logger.info(`Payment succeeded for subscription ${subscriptionId}`, {}, "BillingWebhook");
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) return;

    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(subscriptionId);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${subscriptionId}`, {}, "BillingWebhook");
      return;
    }

    const now = new Date();
    const gracePeriodEndsAt = new Date(now.getTime() + SUBSCRIPTION_CONSTANTS.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await this.subscriptionRepository.update(subscription._id!, {
      status: SubscriptionStatus.PAST_DUE,
      gracePeriodEndsAt,
    });

    logger.info(`Payment failed for subscription ${subscriptionId}`, {}, "BillingWebhook");
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${stripeSubscription.id}`, {}, "BillingWebhook");
      return;
    }

    const newPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    const newPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    const periodChanged =
      subscription.currentPeriodStart.getTime() !== newPeriodStart.getTime() ||
      subscription.currentPeriodEnd.getTime() !== newPeriodEnd.getTime();

    const priceId = stripeSubscription.items.data[0]?.price?.id;
    const updateData: Partial<Subscription> = {
      currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd,
    };

    if (periodChanged && subscription.pendingPlanId) {
      updateData.planId = subscription.pendingPlanId;
      updateData.pendingPlanId = undefined;
      logger.info(`Applied pending plan change for subscription ${stripeSubscription.id}`, {}, "BillingWebhook");
    } else if (priceId) {
      const plan = await this.planRepository.findByStripePriceId(priceId);
      if (plan && plan._id !== subscription.planId && !subscription.pendingPlanId) {
        updateData.planId = plan._id!;
      }
    }

    let status = SubscriptionStatus.ACTIVE;
    if (stripeSubscription.status === "canceled") {
      status = SubscriptionStatus.CANCELLED;
    } else if (stripeSubscription.status === "past_due") {
      status = SubscriptionStatus.PAST_DUE;
    } else if (stripeSubscription.status === "trialing") {
      status = SubscriptionStatus.TRIALING;
    }

    updateData.status = status;
    updateData.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;

    await this.subscriptionRepository.update(subscription._id!, updateData);

    logger.info(`Subscription updated: ${stripeSubscription.id}`, {}, "BillingWebhook");
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
    const subscription = await this.subscriptionRepository.findByProviderSubscriptionId(stripeSubscription.id);
    if (!subscription) {
      logger.warn(`Subscription not found for Stripe subscription ${stripeSubscription.id}`, {}, "BillingWebhook");
      return;
    }

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
