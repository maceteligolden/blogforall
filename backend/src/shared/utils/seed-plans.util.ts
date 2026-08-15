import { container } from "tsyringe";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../database";
import { plans } from "../database/schema";
import { StripeFacade } from "../facade/stripe.facade";
import { env } from "../config/env";
import { logger } from "./logger";

const LANDING_PLAN_NAMES = ["Free", "Starter", "Professional", "Enterprise"] as const;

export const FREE_PLAN_DAILY_TOKENS = 400_000;

export async function syncFreePlanTokenLimit(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: plans.id, limits: plans.limits })
      .from(plans)
      .where(eq(plans.name, "Free"))
      .limit(1);
    if (!existing) {
      logger.info('Plan "Free" not found; skip daily token sync', {}, "PlanSeeder");
      return;
    }
    const limits = { ...(existing.limits ?? {}), dailyTokens: FREE_PLAN_DAILY_TOKENS };
    await db.update(plans).set({ limits, updated_at: new Date() }).where(eq(plans.id, existing.id));
    logger.info(`Synced Free plan dailyTokens to ${FREE_PLAN_DAILY_TOKENS}`, {}, "PlanSeeder");
  } catch (error) {
    logger.error("Failed to sync Free plan daily token limit", error as Error, {}, "PlanSeeder");
  }
}

export async function seedPlansIfNeeded(): Promise<void> {
  try {
    await db
      .update(plans)
      .set({ isActive: false, updated_at: new Date() })
      .where(notInArray(plans.name, [...LANDING_PLAN_NAMES]));

    const [countRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(plans)
      .where(and(eq(plans.isActive, true), inArray(plans.name, [...LANDING_PLAN_NAMES])));
    const activeCount = Number(countRow?.value ?? 0);
    const MIN_REQUIRED_PLANS = 4;

    if (activeCount >= MIN_REQUIRED_PLANS) {
      logger.info(
        `Plans match landing (${activeCount} active: ${LANDING_PLAN_NAMES.join(", ")}), skipping seed`,
        {},
        "PlanSeeder"
      );
      return;
    }

    logger.info(`Seeding plans to match landing (${LANDING_PLAN_NAMES.join(", ")})...`, {}, "PlanSeeder");
    const stripeFacade = container.resolve(StripeFacade);

    const paidPlans = [
      {
        name: "Starter",
        price: 5,
        interval: "month" as const,
        limits: {
          blogPosts: 10,
          apiCallsPerMonth: 10000,
          storageGB: 1,
          maxSitesAllowed: 1,
          dailyTokens: 300_000,
        },
        features: [
          "Up to 10 blog posts",
          "AI blog generation",
          "AI content review",
          "1 site",
          "Basic campaigns",
          "API access",
        ],
        isActive: true,
      },
      {
        name: "Professional",
        price: 10,
        interval: "month" as const,
        limits: {
          blogPosts: 50,
          apiCallsPerMonth: 100000,
          storageGB: 10,
          maxSitesAllowed: 3,
          dailyTokens: 1_000_000,
        },
        features: [
          "Up to 50 blog posts",
          "Advanced AI features",
          "3 sites",
          "Unlimited campaigns",
          "Team collaboration",
          "Campaign templates",
          "Priority support",
        ],
        isActive: true,
      },
      {
        name: "Enterprise",
        price: 20,
        interval: "month" as const,
        limits: {
          blogPosts: -1,
          apiCallsPerMonth: -1,
          storageGB: -1,
          maxSitesAllowed: -1,
          dailyTokens: -1,
        },
        features: [
          "Unlimited blog posts",
          "All AI features",
          "Unlimited sites",
          "Advanced API features",
          "Unlimited team members",
          "Custom integrations",
          "24/7 priority support",
        ],
        isActive: true,
      },
    ];

    const hasStripeKey = !!env.stripe.apiKey;

    for (const planData of paidPlans) {
      try {
        const [existingPlan] = await db
          .select({ id: plans.id })
          .from(plans)
          .where(eq(plans.name, planData.name))
          .limit(1);
        if (existingPlan) {
          await db.update(plans).set({ isActive: true, updated_at: new Date() }).where(eq(plans.name, planData.name));
          logger.info(`Plan "${planData.name}" already exists, ensured active`, {}, "PlanSeeder");
          continue;
        }

        let stripePriceId: string | undefined;
        if (hasStripeKey) {
          try {
            const product = await stripeFacade.findOrCreateProduct(
              `Bloggr ${planData.name}`,
              `Bloggr ${planData.name} Plan`
            );
            const price = await stripeFacade.createPrice(product.id, planData.price, "usd", planData.interval);
            stripePriceId = price.id;
          } catch (stripeError) {
            logger.warn(
              `Failed to create Stripe product/price for ${planData.name}, creating plan without Stripe`,
              { err: stripeError instanceof Error ? stripeError.message : String(stripeError) },
              "PlanSeeder"
            );
          }
        }

        await db.insert(plans).values({
          ...planData,
          stripe_price_id: stripePriceId,
          currency: "usd",
        });
        logger.info(
          `Created plan: ${planData.name}${stripePriceId ? ` (Stripe: ${stripePriceId})` : " (no Stripe)"}`,
          {},
          "PlanSeeder"
        );
      } catch (error) {
        logger.error(`Failed to create plan ${planData.name}`, error as Error, {}, "PlanSeeder");
      }
    }

    const freePlanData = {
      name: "Free",
      price: 0,
      interval: "free" as const,
      limits: {
        blogPosts: 3,
        apiCallsPerMonth: 1000,
        storageGB: 0.5,
        maxSitesAllowed: 1,
        dailyTokens: FREE_PLAN_DAILY_TOKENS,
      },
      features: ["Up to 3 blog posts", "1,000 API calls/month", "0.5 GB storage", "Basic features"],
      isActive: true,
    };

    try {
      const [existingFree] = await db
        .select({ id: plans.id })
        .from(plans)
        .where(eq(plans.name, freePlanData.name))
        .limit(1);
      if (existingFree) {
        await db
          .update(plans)
          .set({
            isActive: true,
            limits: freePlanData.limits,
            updated_at: new Date(),
          })
          .where(eq(plans.name, freePlanData.name));
        logger.info(`Plan "Free" already exists, ensured active and token limit`, {}, "PlanSeeder");
      } else {
        await db.insert(plans).values(freePlanData);
        logger.info("Created plan: Free", {}, "PlanSeeder");
      }
    } catch (error) {
      logger.error("Failed to create free plan", error as Error, {}, "PlanSeeder");
    }

    logger.info("Plan seeding completed", {}, "PlanSeeder");
  } catch (error) {
    logger.error("Error seeding plans", error as Error, {}, "PlanSeeder");
  }
}
