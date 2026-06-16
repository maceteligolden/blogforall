import User from "../schemas/user.schema";
import { UserRole, UserPlan, isPlatformAdminRole } from "../constants";
import { hashPassword } from "./password";
import { logger } from "./logger";

export interface SeedPlatformAdminInput {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  roleRaw?: string;
}

export async function seedPlatformAdminIfNeeded(input: SeedPlatformAdminInput): Promise<{
  status: "skipped" | "created";
  reason?: string;
  email?: string;
}> {
  const email = input.email?.trim().toLowerCase();
  const password = input.password;
  const firstName = input.firstName?.trim() || "Platform";
  const lastName = input.lastName?.trim() || "Admin";
  const roleCandidate = input.roleRaw?.trim() || UserRole.SUPER_ADMIN;
  const role =
    roleCandidate === UserRole.SUPER_ADMIN || roleCandidate === UserRole.ADMIN
      ? roleCandidate
      : UserRole.SUPER_ADMIN;

  if (!email || !password) {
    return { status: "skipped", reason: "missing_credentials" };
  }

  if (!isPlatformAdminRole(role)) {
    return { status: "skipped", reason: "invalid_role" };
  }

  const existing = await User.findOne({ email });
  if (existing) {
    logger.info("Platform admin seed skipped: account already exists", { email }, "SeedPlatformAdmin");
    return { status: "skipped", reason: "already_exists", email };
  }

  const hashedPassword = await hashPassword(password);
  await User.create({
    email,
    password: hashedPassword,
    first_name: firstName,
    last_name: lastName,
    role,
    plan: UserPlan.FREE,
    onboarding_completed: true,
  });

  logger.info("Platform admin created by seed", { email, role }, "SeedPlatformAdmin");
  return { status: "created", email };
}
