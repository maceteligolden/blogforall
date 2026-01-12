import { container } from "tsyringe";
import { PlanModel } from "../schemas/plan.schema";
import { StripeFacade } from "../facade/stripe.facade";
import { logger } from "./logger";

export async function seedPlansIfNeeded(): Promise<void> {
  try {
    // Check if any plans exist
    const existingPlansCount = await PlanModel.countDocuments();
    
    if (existingPlansCount > 0) {
      logger.info(`Plans already exist (${existingPlansCount} plans found), skipping seed`, {}, "PlanSeeder");
      return;
    }

    logger.info("No plans found, seeding plans...", {}, "PlanSeeder");
    const stripeFacade = container.resolve(StripeFacade);

    const plans = [
      {
        name: "Starter",
        price: 5,
        interval: "month" as const,
        limits: {
          blogPosts: 10,
          apiCallsPerMonth: 10000,
          storageGB: 1,
        },
        features: [
          "Up to 10 blog posts",
          "10,000 API calls/month",
          "1 GB storage",
          "Basic support",
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
        let stripePriceId: string | undefined;
        
        if (hasStripeKey) {
          try {
            // Create product in Stripe
            const product = await stripeFacade.findOrCreateProduct(
              `BlogForAll ${planData.name}`,
              `BlogForAll ${planData.name} Plan`
            );

            // Create price in Stripe
            const price = await stripeFacade.createPrice(
              product.id,
              planData.price,
              "usd",
              planData.interval
            );
            
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
      features: [
        "Up to 3 blog posts",
        "1,000 API calls/month",
        "0.5 GB storage",
        "Basic features",
      ],
      isActive: true,
    };

    try {
      const freePlan = new PlanModel(freePlanData);
      await freePlan.save();
      logger.info(`✓ Created plan: ${freePlanData.name}`, {}, "PlanSeeder");
    } catch (error) {
      logger.error(`Failed to create free plan`, error as Error, {}, "PlanSeeder");
    }

    logger.info("✅ Plan seeding completed!", {}, "PlanSeeder");
  } catch (error) {
    logger.error("Error seeding plans", error as Error, {}, "PlanSeeder");
    // Don't throw - allow server to start even if seeding fails
  }
}
