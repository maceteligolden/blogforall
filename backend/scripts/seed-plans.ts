import "reflect-metadata";
import "dotenv/config";
import { connectDatabase } from "../src/shared/database";
import { PlanModel } from "../src/shared/schemas/plan.schema";
import { StripeFacade } from "../src/shared/facade/stripe.facade";
import { container } from "tsyringe";

const LANDING_PLAN_NAMES = ["Free", "Starter", "Professional", "Enterprise"] as const;

async function seedPlans() {
  try {
    await connectDatabase();
    await PlanModel.updateMany(
      { name: { $nin: LANDING_PLAN_NAMES } },
      { $set: { isActive: false } }
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

    console.log("Creating plans to match landing page (Starter, Professional, Enterprise + Free)...");

    for (const planData of paidPlans) {
      const existingPlan = await PlanModel.findOne({ name: planData.name });
      if (existingPlan) {
        console.log(`Plan "${planData.name}" already exists, skipping...`);
        continue;
      }
      try {
        const product = await stripeFacade.findOrCreateProduct(
          `Bloggr ${planData.name}`,
          `Bloggr ${planData.name} Plan`
        );
        const price = await stripeFacade.createPrice(
          product.id,
          planData.price,
          "usd",
          planData.interval
        );
        const plan = new PlanModel({
          ...planData,
          stripe_price_id: price.id,
          currency: "usd",
        });
        await plan.save();
        console.log(`✓ Created plan: ${planData.name} (Stripe Price ID: ${price.id})`);
      } catch (err) {
        console.warn(`Stripe or save failed for ${planData.name}, creating without Stripe:`, err);
        const plan = new PlanModel({ ...planData, currency: "usd" });
        await plan.save();
        console.log(`✓ Created plan: ${planData.name} (no Stripe)`);
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
      features: [
        "Up to 3 blog posts",
        "1,000 API calls/month",
        "0.5 GB storage",
        "Basic features",
      ],
      isActive: true,
    };

    const existingFree = await PlanModel.findOne({ name: freePlanData.name });
    if (!existingFree) {
      const freePlan = new PlanModel(freePlanData);
      await freePlan.save();
      console.log(`✓ Created plan: Free`);
    } else {
      console.log(`Plan "Free" already exists, skipping...`);
    }

    console.log("\n✅ Plan seeding completed! Active plans: Free, Starter, Professional, Enterprise.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  }
}

seedPlans();
