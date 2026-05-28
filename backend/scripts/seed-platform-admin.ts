import "reflect-metadata";
import "dotenv/config";
import { connectDatabase } from "../src/shared/database";
import User from "../src/shared/schemas/user.schema";
import { UserRole, UserPlan, isPlatformAdminRole } from "../src/shared/constants";
import { hashPassword } from "../src/shared/utils/password";

async function seedPlatformAdmin(): Promise<void> {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;
  const firstName = process.env.ADMIN_SEED_FIRST_NAME?.trim() || "Platform";
  const lastName = process.env.ADMIN_SEED_LAST_NAME?.trim() || "Admin";
  const roleRaw = process.env.ADMIN_SEED_ROLE?.trim() || UserRole.SUPER_ADMIN;

  if (!email || !password) {
    console.error("ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are required.");
    process.exit(1);
  }

  const role =
    roleRaw === UserRole.SUPER_ADMIN || roleRaw === UserRole.ADMIN ? roleRaw : UserRole.SUPER_ADMIN;

  if (!isPlatformAdminRole(role)) {
    console.error(`ADMIN_SEED_ROLE must be "${UserRole.ADMIN}" or "${UserRole.SUPER_ADMIN}".`);
    process.exit(1);
  }

  await connectDatabase();

  const existing = await User.findOne({ email });
  const hashedPassword = await hashPassword(password);

  if (existing) {
    existing.password = hashedPassword;
    existing.role = role;
    existing.first_name = firstName;
    existing.last_name = lastName;
    existing.onboarding_completed = true;
    existing.updated_at = new Date();
    await existing.save();
    console.log(`Updated platform admin: ${email} (role: ${role})`);
  } else {
    await User.create({
      email,
      password: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      role,
      plan: UserPlan.FREE,
      onboarding_completed: true,
    });
    console.log(`Created platform admin: ${email} (role: ${role})`);
  }

  process.exit(0);
}

seedPlatformAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
