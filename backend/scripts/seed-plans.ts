import "reflect-metadata";
import "dotenv/config";
import { connectDatabase } from "../src/shared/database";
import { seedPlansIfNeeded } from "../src/shared/utils/seed-plans.util";

async function seedPlans() {
  try {
    await connectDatabase();
    await seedPlansIfNeeded();
    process.exit(0);
  } catch (error) {
    console.error("Error seeding plans:", error);
    process.exit(1);
  }
}

void seedPlans();
