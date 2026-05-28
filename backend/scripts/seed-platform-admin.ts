import "reflect-metadata";
import "dotenv/config";
import { connectDatabase } from "../src/shared/database";
import { seedPlatformAdminIfNeeded } from "../src/shared/utils/seed-platform-admin.util";

async function seedPlatformAdmin(): Promise<void> {
  if (!process.env.ADMIN_SEED_EMAIL?.trim() || !process.env.ADMIN_SEED_PASSWORD) {
    console.error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.");
    process.exit(1);
  }

  await connectDatabase();
  const result = await seedPlatformAdminIfNeeded({
    email: process.env.ADMIN_SEED_EMAIL,
    password: process.env.ADMIN_SEED_PASSWORD,
    firstName: process.env.ADMIN_SEED_FIRST_NAME,
    lastName: process.env.ADMIN_SEED_LAST_NAME,
    roleRaw: process.env.ADMIN_SEED_ROLE,
  });

  if (result.status === "created") {
    console.log(`Created platform admin: ${result.email}`);
  } else if (result.reason === "already_exists") {
    console.log(`Seed skipped: platform admin already exists (${result.email})`);
  } else {
    console.log(`Seed skipped: ${result.reason}`);
  }

  process.exit(0);
}

seedPlatformAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
