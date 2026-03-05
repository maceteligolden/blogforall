import { container } from "tsyringe";
import { PlanModel } from "../schemas/plan.schema";
import { StripeFacade } from "../facade/stripe.facade";
import { logger } from "./logger";

/** Plan names that match the landing page; only these are kept active and seeded. */
const LANDING_PLAN_NAMES = ["Free", "Starter", "Professional", "Enterprise"] as const;

export async function seedPlansIfNeeded(): Promise<void> {
  try {
    await PlanModel.updateMany(
      { name: { $nin: LANDING_PLAN_NAMES } },
      { $set: { isActive: false } }
    );

    const activeCount = await PlanModel.countDocuments({ isActive: true, name: { $in: LANDING_PLAN_NAMES } });
    const MIN_REQUIRED_PLANS = 4;

    if (activeCount >= MIN_REQUIRED_PLANS) {
      logger.info(
        `Plans match landing (${activeCount} active: ${LANDING_PLAN_NAMES.join(", ")}), skipping seed`,
        {},
        "PlanSeeder"
      );
      return;
    }

    logger.info(
      `Seeding plans to match landing (${LANDING_PLAN_NAMES.join(", ")})...`,
      {},
      "PlanSeeder"
    );
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

    const hasStripeKey = !!process.env.STRIPE_API_KEY;

    for (const planData of paidPlans) {
      try {
        const existingPlan = await PlanModel.findOne({ name: planData.name });
        if (existingPlan) {
          await PlanModel.updateOne({ name: planData.name }, { $set: { isActive: true } });
          logger.info(`Plan "${planData.name}" already exists, ensured active`, {}, "PlanSeeder");
          continue;
        }

        let stripePriceId: string | undefined;
        if (hasStripeKey) {
          try {
            const product = await stripeFacade.findOrCreateProduct(
              `BlogForAll ${planData.name}`,
              `BlogForAll ${planData.name} Plan`
            );
            const price = await stripeFacade.createPrice(product.id, planData.price, "usd", planData.interval);
            stripePriceId = price.id;
          } catch (stripeError) {
            logger.warn(
              `Failed to create Stripe product/price for ${planData.name}, creating plan without Stripe`,
              stripeError as Error,
              "PlanSeeder"
            );
          }
        }

        const plan = new PlanModel({
          ...planData,
          stripe_price_id: stripePriceId,
          currency: "usd",
        });
        await plan.save();
        logger.info(
          `✓ Created plan: ${planData.name}${stripePriceId ? ` (Stripe: ${stripePriceId})` : " (no Stripe)"}`,
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
      },
      features: ["Up to 3 blog posts", "1,000 API calls/month", "0.5 GB storage", "Basic features"],
      isActive: true,
    };

    try {
      const existingFree = await PlanModel.findOne({ name: freePlanData.name });
      if (existingFree) {
        await PlanModel.updateOne({ name: freePlanData.name }, { $set: { isActive: true } });
        logger.info(`Plan "Free" already exists, ensured active`, {}, "PlanSeeder");
      } else {
        const freePlan = new PlanModel(freePlanData);
        await freePlan.save();
        logger.info(`✓ Created plan: Free`, {}, "PlanSeeder");
      }
    } catch (error) {
      logger.error(`Failed to create free plan`, error as Error, {}, "PlanSeeder");
    }

    logger.info("✅ Plan seeding completed!", {}, "PlanSeeder");
  } catch (error) {
    logger.error("Error seeding plans", error as Error, {}, "PlanSeeder");
    // Don't throw - allow server to start even if seeding fails
  }
}
