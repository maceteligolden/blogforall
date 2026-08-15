import { injectable } from "tsyringe";
import { and, desc, eq, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { User as UserType } from "../../../shared/schemas/user.schema";
import { UserRole } from "../../../shared/constants";
import { db } from "../../../shared/database";
import { users } from "../../../shared/database/schema";
import { omitUndefined, withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class UserRepository {
  private toEntity(row: typeof users.$inferSelect): UserType {
    return withId(row) as unknown as UserType;
  }

  async create(userData: Partial<UserType>): Promise<UserType> {
    const [row] = await db
      .insert(users)
      .values({
        email: userData.email!.toLowerCase(),
        password: userData.password!,
        first_name: userData.first_name!,
        last_name: userData.last_name!,
        phone_number: userData.phone_number,
        role: userData.role ?? UserRole.USER,
        plan: userData.plan,
        sessionToken: userData.sessionToken,
        stripe_customer_id: userData.stripe_customer_id,
        onboarding_completed: userData.onboarding_completed ?? false,
        terms_accepted_at: userData.terms_accepted_at,
        terms_version: userData.terms_version,
        referral_code: userData.referral_code,
        referred_by_user_id: userData.referred_by_user_id,
        email_verified: userData.email_verified ?? false,
        company_role: userData.company_role,
        company_role_detail: userData.company_role_detail,
        show_welcome_tour: userData.show_welcome_tour ?? false,
      })
      .returning();
    return this.toEntity(row);
  }

  async findByEmail(email: string): Promise<UserType | null> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByReferralCode(code: string): Promise<UserType | null> {
    const [row] = await db.select().from(users).where(eq(users.referral_code, code.toUpperCase())).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findById(id: string): Promise<UserType | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findByIds(ids: string[]): Promise<UserType[]> {
    if (!ids.length) return [];
    const rows = await db.select().from(users).where(inArray(users.id, ids));
    return withIds(rows) as unknown as UserType[];
  }

  async findUsersForAdminList(input: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ data: UserType[]; total: number }> {
    const { page, limit, search } = input;
    const offset = (page - 1) * limit;
    const filters = [eq(users.role, UserRole.USER)];
    if (search) {
      filters.push(
        or(
          ilike(users.email, `%${search}%`),
          ilike(users.first_name, `%${search}%`),
          ilike(users.last_name, `%${search}%`)
        )!
      );
    }
    const where = and(...filters);
    const [data, totalRows] = await Promise.all([
      db.select().from(users).where(where).orderBy(desc(users.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(users)
        .where(where),
    ]);
    return { data: withIds(data) as unknown as UserType[], total: Number(totalRows[0]?.value ?? 0) };
  }

  async countByRole(roles: UserRole | UserRole[]): Promise<number> {
    const list = Array.isArray(roles) ? roles : [roles];
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(users)
      .where(inArray(users.role, list));
    return Number(row?.value ?? 0);
  }

  async update(id: string, updateData: Partial<UserType>): Promise<UserType | null> {
    const { _id: _ignored, id: _idIgnored, ...rest } = updateData as Partial<UserType> & { id?: string };
    const [row] = await db
      .update(users)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async updateSessionToken(id: string, token: string | null): Promise<void> {
    await db.update(users).set({ sessionToken: token, updated_at: new Date() }).where(eq(users.id, id));
  }

  async findByResetToken(hashedToken: string): Promise<UserType | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.resetPasswordToken, hashedToken), gt(users.resetPasswordExpires, new Date())))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async setResetCode(id: string, hashedCode: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        resetPasswordToken: hashedCode,
        resetPasswordExpires: expiresAt,
        resetPasswordAttempts: 0,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async incrementResetAttempts(id: string): Promise<number> {
    const [row] = await db
      .update(users)
      .set({
        resetPasswordAttempts: sql`${users.resetPasswordAttempts} + 1`,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ resetPasswordAttempts: users.resetPasswordAttempts });
    return row?.resetPasswordAttempts ?? 0;
  }

  async clearResetCode(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        resetPasswordAttempts: 0,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async setEmailVerificationCode(id: string, hashedCode: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        email_verification_token: hashedCode,
        email_verification_expires: expiresAt,
        email_verification_attempts: 0,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async incrementEmailVerificationAttempts(id: string): Promise<number> {
    const [row] = await db
      .update(users)
      .set({
        email_verification_attempts: sql`${users.email_verification_attempts} + 1`,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ email_verification_attempts: users.email_verification_attempts });
    return row?.email_verification_attempts ?? 0;
  }

  async clearEmailVerificationCode(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        email_verification_attempts: 0,
        email_verification_token: null,
        email_verification_expires: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async markEmailVerified(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        email_verified: true,
        email_verification_attempts: 0,
        email_verification_token: null,
        email_verification_expires: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: hashedPassword,
        resetPasswordAttempts: 0,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updated_at: new Date(),
      })
      .where(eq(users.id, id));
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    return rows.length > 0;
  }
}
