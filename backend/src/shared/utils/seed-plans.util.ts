import { container } from "tsyringe";
import { PlanModel } from "../schemas/plan.schema";
import { StripeFacade } from "../facade/stripe.facade";
import { logger } from "./logger";

export async function seedPlansIfNeeded(): Promise<void> {
  try {
    // Check if we have at least 3 plans
    const existingPlansCount = await PlanModel.countDocuments();
    const MIN_REQUIRED_PLANS = 3;

    if (existingPlansCount >= MIN_REQUIRED_PLANS) {
      logger.info(`Sufficient plans exist (${existingPlansCount} plans found, minimum required: ${MIN_REQUIRED_PLANS}), skipping seed`, {}, "PlanSeeder");
      return;
    }

    logger.info(`Insufficient plans found (${existingPlansCount} found, minimum required: ${MIN_REQUIRED_PLANS}), seeding plans...`, {}, "PlanSeeder");
    const stripeFacade = container.resolve(StripeFacade);

    const plans = [
      {
        name: "Basic",
        price: 3,
        interval: "month" as const,
        limits: {
          blogPosts: 5,
          apiCallsPerMonth: 5000,
          storageGB: 0.5,
        },
        features: ["Up to 5 blog posts", "5,000 API calls/month", "0.5 GB storage", "Email support"],
        isActive: true,
      },
      {
        name: "Starter",
        price: 5,
        interval: "month" as const,
        limits: {
          blogPosts: 10,
          apiCallsPerMonth: 10000,
          storageGB: 1,
        },
        features: ["Up to 10 blog posts", "10,000 API calls/month", "1 GB storage", "Basic support"],
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
        },
        features: [
          "Up to 50 blog posts",
          "100,000 API calls/month",
          "10 GB storage",
          "Advanced analytics",
          "Priority support",
          "Custom categories",
        ],
        isActive: true,
      },
      {
        name: "Business",
        price: 15,
        interval: "month" as const,
        limits: {
          blogPosts: 200,
          apiCallsPerMonth: 500000,
          storageGB: 50,
        },
        features: [
          "Up to 200 blog posts",
          "500,000 API calls/month",
          "50 GB storage",
          "Advanced analytics",
          "Priority support",
          "Custom categories",
          "API access",
          "Custom branding",
        ],
        isActive: true,
      },
      {
        name: "Enterprise",
        price: 20,
        interval: "month" as const,
        limits: {
          blogPosts: -1, // Unlimited
          apiCallsPerMonth: -1, // Unlimited
          storageGB: -1, // Unlimited
        },
        features: [
          "Unlimited blog posts",
          "Unlimited API calls",
          "Unlimited storage",
          "White-label options",
          "24/7 priority support",
          "Custom integrations",
          "Dedicated account manager",
        ],
        isActive: true,
      },
    ];

    // Create paid plans with Stripe integration
    // Only create Stripe products/prices if Stripe API key is configured
    const hasStripeKey = !!process.env.STRIPE_API_KEY;

    for (const planData of plans) {
      try {
        // Check if plan already exists
        const existingPlan = await PlanModel.findOne({ name: planData.name });
        if (existingPlan) {
          logger.info(`Plan "${planData.name}" already exists, skipping...`, {}, "PlanSeeder");
          continue;
        }

        let stripePriceId: string | undefined;

        if (hasStripeKey) {
          try {
            // Create product in Stripe
            const product = await stripeFacade.findOrCreateProduct(
              `BlogForAll ${planData.name}`,
              `BlogForAll ${planData.name} Plan`
            );

            // Create price in Stripe
            const price = await stripeFacade.createPrice(product.id, planData.price, "usd", planData.interval);

            stripePriceId = price.id;
          } catch (stripeError) {
            logger.warn(
              `Failed to create Stripe product/price for ${planData.name}, creating plan without Stripe integration`,
              stripeError as Error,
              "PlanSeeder"
            );
          }
        } else {
          logger.warn(
            `STRIPE_API_KEY not configured, creating plan ${planData.name} without Stripe integration`,
            {},
            "PlanSeeder"
          );
        }

        // Create plan in database (with or without Stripe price ID)
        const plan = new PlanModel({
          ...planData,
          stripe_price_id: stripePriceId,
          currency: "usd",
        });

        await plan.save();
        logger.info(
          `✓ Created plan: ${planData.name}${stripePriceId ? ` (Stripe Price ID: ${stripePriceId})` : " (no Stripe integration)"}`,
          {},
          "PlanSeeder"
        );
      } catch (error) {
        logger.error(`Failed to create plan ${planData.name}`, error as Error, {}, "PlanSeeder");
        // Continue with other plans even if one fails
      }
    }

    // Create free plan (no Stripe price needed)
    const freePlanData = {
      name: "Free",
      price: 0,
      interval: "free" as const,
      limits: {
        blogPosts: 3,
        apiCallsPerMonth: 1000,
        storageGB: 0.5,
      },
      features: ["Up to 3 blog posts", "1,000 API calls/month", "0.5 GB storage", "Basic features"],
      isActive: true,
    };

    try {
      // Check if free plan already exists
      const existingFreePlan = await PlanModel.findOne({ name: freePlanData.name });
      if (!existingFreePlan) {
        const freePlan = new PlanModel(freePlanData);
        await freePlan.save();
        logger.info(`✓ Created plan: ${freePlanData.name}`, {}, "PlanSeeder");
      } else {
        logger.info(`Plan "${freePlanData.name}" already exists, skipping...`, {}, "PlanSeeder");
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
