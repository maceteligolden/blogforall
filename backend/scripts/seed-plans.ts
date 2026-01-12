import "reflect-metadata";
import "dotenv/config";
import { connectDatabase } from "../src/shared/database";
import { PlanModel } from "../src/shared/schemas/plan.schema";
import { StripeFacade } from "../src/shared/facade/stripe.facade";
import { container } from "tsyringe";

async function seedPlans() {
  try {
    await connectDatabase();
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

    console.log("Creating plans in Stripe and database...");

    for (const planData of plans) {
      // Check if plan already exists
      const existingPlan = await PlanModel.findOne({ name: planData.name });
      if (existingPlan) {
        console.log(`Plan "${planData.name}" already exists, skipping...`);
        continue;
      }

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

      // Create plan in database
      const plan = new PlanModel({
        ...planData,
        stripe_price_id: price.id,
        currency: "usd",
      });

      await plan.save();
      console.log(`✓ Created plan: ${planData.name} (Stripe Price ID: ${price.id})`);
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

    const existingFreePlan = await PlanModel.findOne({ name: freePlanData.name });
    if (!existingFreePlan) {
      const freePlan = new PlanModel(freePlanData);
      await freePlan.save();
      console.log(`✓ Created plan: ${freePlanData.name}`);
    } else {
      console.log(`Plan "${freePlanData.name}" already exists, skipping...`);
    }

    console.log("\n✅ Plan seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  }
}

seedPlans();
