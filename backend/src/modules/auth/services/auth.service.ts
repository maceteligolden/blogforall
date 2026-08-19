import { injectable } from "tsyringe";
import { createHash, randomInt } from "crypto";
import { UserRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../../../shared/utils/password";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../../shared/utils/token";
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  TooManyRequestsError,
} from "../../../shared/errors";
import { UserPlan, UserRole, isPlatformAdminRole } from "../../../shared/constants";
import { Site } from "../../../shared/schemas/site.schema";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { logger } from "../../../shared/utils/logger";
import { assertSlidingWindowRateLimit } from "../../../shared/utils/sliding-window-rate-limit";
import {
  SignupInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  VerifyResetCodeInput,
  ResetPasswordInput,
  LoginResponse,
} from "../interfaces/auth.interface";
import { User } from "../../../shared/schemas/user.schema";
import { StripeFacade } from "../../../shared/facade/stripe.facade";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { SiteService } from "../../site/services/site.service";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";
import { ReferralService } from "../../referral/services/referral.service";
import { SiteInvitationService } from "../../site/services/site-invitation.service";
import { env } from "../../../shared/config/env";
import {
  captureServerEvent,
  identifyServerUser,
  ServerAnalyticsEvents,
} from "../../../shared/analytics/posthog.server";

/** Legacy accounts predate email verification — treat unset as verified. */
function isEmailVerified(user: User): boolean {
  if (user.email_verified === true) return true;
  if (user.email_verified === false) return false;
  return true;
}

@injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private stripeFacade: StripeFacade,
    private subscriptionService: SubscriptionService,
    private siteService: SiteService,
    private notificationService: NotificationService,
    private referralService: ReferralService,
    private siteInvitationService: SiteInvitationService,
    private blogRepository: BlogRepository
  ) {}

  /**
   * Create account, send email OTP, auto-login. Does NOT send welcome email
   * or fire USER_SIGNED_UP until the signup wizard completes.
   */
  async signup(input: SignupInput): Promise<LoginResponse> {
    const { email, password, first_name, last_name, phone_number, terms_version, referral_code, invite_token } = input;

    const formattedEmail = email.toLocaleLowerCase();

    const existingUser = await this.userRepository.findByEmail(formattedEmail);
    if (existingUser) {
      logger.warn("Signup attempt with existing email", { email: formattedEmail }, "AuthService");
      throw new BadRequestError("That email is already in use. Try logging in instead.");
    }

    let effectiveReferralCode = referral_code;
    const hasValidInvite = !!invite_token?.trim();
    if (hasValidInvite) {
      const { inviterReferralCode } = await this.siteInvitationService.validateInviteForSignup(
        invite_token!.trim(),
        formattedEmail
      );
      effectiveReferralCode = effectiveReferralCode ?? inviterReferralCode;
    }

    const hashedPassword = await hashPassword(password);

    let stripeCustomerId: string | undefined;
    try {
      const customer = await this.stripeFacade.createCustomer(formattedEmail, `${first_name} ${last_name}`.trim());
      stripeCustomerId = customer.id;
    } catch (error) {
      logger.error("Failed to create Stripe customer", error as Error, { email: formattedEmail }, "AuthService");
    }

    const user = await this.userRepository.create({
      email: formattedEmail,
      password: hashedPassword,
      first_name,
      last_name,
      phone_number,
      plan: UserPlan.FREE,
      stripe_customer_id: stripeCustomerId,
      onboarding_completed: false,
      email_verified: false,
      terms_accepted_at: new Date(),
      terms_version: terms_version ?? undefined,
    });

    try {
      await this.subscriptionService.createFreeSubscription(user._id!.toString());
    } catch (error) {
      logger.error("Failed to create free subscription on signup", error as Error, { userId: user._id }, "AuthService");
    }

    try {
      await this.referralService.ensureReferralCode(user._id!.toString());
      await this.referralService.recordReferralOnSignup(user._id!.toString(), effectiveReferralCode);
    } catch (error) {
      logger.error("Failed to process referral on signup", error as Error, { userId: user._id }, "AuthService");
    }

    try {
      await this.siteInvitationService.deliverPendingInviteNotifications(user._id!.toString(), formattedEmail);
    } catch (error) {
      logger.error(
        "Failed to deliver pending invite notifications on signup",
        error as Error,
        { userId: user._id },
        "AuthService"
      );
    }

    await this.sendEmailVerificationCode(user._id!.toString());

    logger.info("User signup started (awaiting email verification)", { userId: user._id, email }, "AuthService");

    const userId = user._id!.toString();
    identifyServerUser(userId, { email: user.email, plan: user.plan });

    const userSites = await this.siteService.getSitesByUser(userId);
    return this.buildLoginResponse(user, userSites);
  }

  async sendEmailVerificationCode(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified) {
      logger.info("Email already verified; skip OTP", { userId }, "AuthService");
      return;
    }

    if (user.email_verification_expires) {
      const issuedAt = user.email_verification_expires.getTime() - EMAIL_VERIFICATION_TTL_MS;
      if (Date.now() - issuedAt < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS) {
        throw new TooManyRequestsError("Please wait a minute before requesting another verification code.");
      }
    }

    assertSlidingWindowRateLimit(`email-verify:${userId}`, {
      windowMs: 60 * 60 * 1000,
      max: 5,
      message: "Too many verification emails. Please wait before requesting another code.",
    });

    const code = this.generatePasswordResetCode();
    const hashedCode = this.hashResetCode(code);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    await this.userRepository.setEmailVerificationCode(userId, hashedCode, expiresAt);

    setImmediate(() => {
      this.notificationService
        .createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.EMAIL_VERIFICATION,
          recipientEmail: user.email,
          templateParams: {
            code,
            expiresInMinutes: String(EMAIL_VERIFICATION_TTL_MINUTES),
            firstName: user.first_name,
          },
        })
        .then(() => {
          logger.info("Email verification OTP enqueued", { userId, email: user.email }, "AuthService");
          captureServerEvent(ServerAnalyticsEvents.EMAIL_VERIFICATION_SENT, { userId });
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("Email verification OTP failed to send", err, { userId, email: user.email }, "AuthService");
        });
    });
  }

  async verifyEmail(userId: string, code: string): Promise<LoginResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.email_verified) {
      const sites = await this.siteService.getSitesByUser(userId);
      return this.buildLoginResponse(user, sites);
    }

    try {
      await this.assertEmailVerificationCodeValid(user, code);
    } catch (error) {
      captureServerEvent(ServerAnalyticsEvents.EMAIL_VERIFICATION_FAILED, {
        userId,
        properties: { reason: error instanceof Error ? error.message : "invalid" },
      });
      throw error;
    }

    await this.userRepository.markEmailVerified(userId);
    captureServerEvent(ServerAnalyticsEvents.EMAIL_VERIFICATION_SUCCEEDED, { userId });
    logger.info("Email verified", { userId, email: user.email }, "AuthService");

    const refreshed = await this.userRepository.findById(userId);
    const sites = await this.siteService.getSitesByUser(userId);
    return this.buildLoginResponse(refreshed ?? user, sites);
  }

  async setCompanyRole(
    userId: string,
    input: { company_role: string; company_role_detail?: string }
  ): Promise<LoginResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (!isEmailVerified(user)) {
      throw new BadRequestError("Please verify your email before continuing.");
    }

    await this.userRepository.update(userId, {
      company_role: input.company_role,
      company_role_detail: input.company_role_detail?.trim() || undefined,
    });
    captureServerEvent(ServerAnalyticsEvents.COMPANY_ROLE_SET, {
      userId,
      properties: { company_role: input.company_role },
    });
    logger.info("Company role set", { userId, company_role: input.company_role }, "AuthService");

    const refreshed = await this.userRepository.findById(userId);
    const sites = await this.siteService.getSitesByUser(userId);
    return this.buildLoginResponse(refreshed ?? user, sites);
  }

  async dismissWelcomeTour(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    await this.userRepository.update(userId, {
      welcome_tour_dismissed_at: new Date(),
      show_welcome_tour: false,
    });
    logger.info("Welcome tour dismissed", { userId }, "AuthService");
  }

  /**
   * Fire welcome email + USER_SIGNED_UP once the signup wizard is fully complete.
   */
  async finalizeSignupCompletion(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    await this.userRepository.update(userId, {
      onboarding_completed: true,
      show_welcome_tour: true,
    });

    identifyServerUser(userId, { email: user.email, plan: user.plan });
    captureServerEvent(ServerAnalyticsEvents.USER_SIGNED_UP, {
      userId,
      properties: {
        plan_type: user.plan,
        company_role: user.company_role,
      },
    });

    const loginUrl = `${env.frontend.baseUrl}/auth/login`;
    const recipientEmail = user.email;
    const firstName = user.first_name;
    setImmediate(() => {
      this.notificationService
        .createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.WELCOME,
          recipientEmail,
          templateParams: { firstName, loginUrl },
        })
        .then(() => {
          logger.info("Welcome email enqueued after wizard complete", { userId, email: recipientEmail }, "AuthService");
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(
            "Welcome email failed (wizard already complete)",
            err,
            { userId, email: recipientEmail, message: err.message },
            "AuthService"
          );
        });
    });
  }

  /**
   * PSEUDOCODE:
   * 1. FIND user by email; if not found THROW UnauthorizedError (invalid credentials)
   * 2. COMPARE password with hash; if invalid THROW UnauthorizedError
   * 3. GET user sites (do NOT ensure default workspace on login so first-time flow shows create-site first)
   * 4. BUILD defaultSiteId from first site if any
   * 5. GENERATE access and refresh tokens with userId, email, currentSiteId
   * 6. UPDATE user sessionToken in DB
   * 7. RETURN tokens, user payload, and requiresSiteCreation true when user has 0 sites
   */
  async login(input: LoginInput): Promise<LoginResponse> {
    const { email, password } = input;

    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) {
      logger.warn("Failed login attempt - user not found", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Failed login attempt - invalid password", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!isEmailVerified(user)) {
      try {
        await this.sendEmailVerificationCode(user._id!.toString());
      } catch (error) {
        logger.error("Failed to resend verification on login", error as Error, { userId: user._id }, "AuthService");
      }
      const userSites = await this.siteService.getSitesByUser(user._id!.toString());
      logger.info("Login with unverified email — verification required", { userId: user._id, email }, "AuthService");
      return this.buildLoginResponse(user, userSites);
    }

    const userSites = await this.siteService.getSitesByUser(user._id!.toString());
    logger.info(
      "User logged in successfully",
      { userId: user._id, email, hasSites: userSites.length > 0 },
      "AuthService"
    );
    return this.buildLoginResponse(user, userSites);
  }

  /**
   * Platform admin login — same credential check as login, but rejects
   * non-platform roles and never forces site onboarding.
   */
  async loginPlatformAdmin(input: LoginInput): Promise<LoginResponse> {
    const { email, password } = input;

    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) {
      logger.warn("Failed platform admin login - user not found", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Failed platform admin login - invalid password", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!isPlatformAdminRole(user.role)) {
      logger.warn("Failed platform admin login - not a platform admin", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    const userSites = await this.siteService.getSitesByUser(user._id!.toString());
    logger.info("Platform admin logged in", { userId: user._id, email, role: user.role }, "AuthService");
    return this.buildLoginResponse(user, userSites);
  }

  /**
   * PSEUDOCODE:
   * 1. UPDATE user sessionToken to null (invalidate refresh)
   * 2. LOG logout
   */
  async logout(userId: string): Promise<void> {
    await this.userRepository.updateSessionToken(userId, null);
    logger.info("User logged out", { userId }, "AuthService");
  }

  /**
   * Full signup rollback: delete account, workspaces, and subscriptions.
   * Only allowed during early onboarding (recent account, onboarding-only workspaces).
   */
  async abandonSignup(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (isPlatformAdminRole(user.role)) {
      throw new ForbiddenError("This account cannot abandon signup");
    }

    const accountAgeMs = Date.now() - new Date(user.created_at ?? 0).getTime();
    const MAX_ABANDON_AGE_MS = 24 * 60 * 60 * 1000;
    if (accountAgeMs > MAX_ABANDON_AGE_MS) {
      throw new BadRequestError("Signup can only be abandoned within 24 hours of registration");
    }

    const ownedSites = await this.siteService.getOwnedSitesByUser(userId);

    if (user.strategist_ready_acknowledged_at) {
      throw new BadRequestError("Signup cannot be abandoned after setup is complete");
    }

    // Allow abandon while unverified or mid-wizard; block if any non-setup content exists.
    for (const site of ownedSites) {
      const siteId = site._id!.toString();
      const publishedCount = await this.blogRepository.countPublishedBySite(siteId);
      if (publishedCount > 0) {
        throw new BadRequestError("Signup cannot be abandoned after content has been published");
      }
    }

    const stage = !isEmailVerified(user)
      ? "email_verification"
      : !user.company_role
        ? "company_role"
        : !user.plan_selection_completed_at
          ? "plan_selection"
          : ownedSites.length === 0
            ? "workspace_name"
            : !user.workspace_invite_prompt_dismissed_at
              ? "invite"
              : "strategist_setup";

    captureServerEvent(ServerAnalyticsEvents.ONBOARDING_DROPPED, {
      userId,
      properties: { stage, email_verified: isEmailVerified(user) },
    });

    for (const site of ownedSites) {
      await this.siteService.deleteSite(site._id!.toString(), userId);
    }

    try {
      await this.subscriptionService.deleteUserSubscriptions(userId);
    } catch (error) {
      logger.error("Failed to delete subscriptions on abandon signup", error as Error, { userId }, "AuthService");
    }

    if (user.stripe_customer_id) {
      try {
        await this.stripeFacade.deleteCustomer(user.stripe_customer_id);
      } catch (error) {
        logger.error("Failed to delete Stripe customer on abandon signup", error as Error, { userId }, "AuthService");
      }
    }

    await this.userRepository.updateSessionToken(userId, null);
    const deleted = await this.userRepository.deleteById(userId);
    if (!deleted) {
      throw new NotFoundError("User not found");
    }

    logger.info("Signup abandoned and account deleted", { userId, email: user.email, stage }, "AuthService");
  }

  /**
   * PSEUDOCODE:
   * 1. VERIFY refresh token and decode payload
   * 2. FIND user by decoded userId; if not found or sessionToken !== refreshToken THROW UnauthorizedError
   * 3. GET user sites for defaultSiteId (or use decoded currentSiteId)
   * 4. GENERATE new access token and RETURN
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await this.userRepository.findById(decoded.userId);

      if (!user || user.sessionToken !== refreshToken) {
        throw new UnauthorizedError("Invalid refresh token");
      }

      const userSites = await this.siteService.getSitesByUser(user._id!.toString());
      const defaultSiteId = userSites.length > 0 ? userSites[0]._id!.toString() : decoded.currentSiteId;

      const accessToken = generateAccessToken({
        userId: user._id!.toString(),
        email: user.email,
        currentSiteId: defaultSiteId,
        role: user.role ?? UserRole.USER,
      });

      return { access_token: accessToken };
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  /**
   * PSEUDOCODE:
   * 1. FIND user by userId; if not found THROW NotFoundError
   * 2. CHECK user has access to siteId via SiteService; if not THROW BadRequestError
   * 3. GENERATE new access token with updated currentSiteId and RETURN
   */
  async updateSiteContext(userId: string, siteId: string): Promise<{ access_token: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const hasAccess = await this.siteService.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new BadRequestError("You do not have access to this site");
    }

    const accessToken = generateAccessToken({
      userId: user._id!.toString(),
      email: user.email,
      currentSiteId: siteId,
      role: user.role ?? UserRole.USER,
    });

    logger.info("Site context updated", { userId, siteId }, "AuthService");
    return { access_token: accessToken };
  }

  /**
   * PSEUDOCODE:
   * 1. FIND user by userId; if not found THROW NotFoundError
   * 2. RETURN profile object (id, email, first_name, last_name, phone_number, plan, created_at, updated_at)
   */
  async getProfile(userId: string): Promise<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    plan: string;
    role: string;
    email_verified: boolean;
    company_role?: string;
    welcome_tour_dismissed: boolean;
    created_at?: Date;
    updated_at?: Date;
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      id: user._id!.toString(),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      plan: user.plan,
      role: user.role ?? UserRole.USER,
      email_verified: Boolean(isEmailVerified(user)),
      company_role: user.company_role,
      welcome_tour_dismissed: !user.show_welcome_tour,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * PSEUDOCODE:
   * 1. FIND user by userId; if not found THROW NotFoundError
   * 2. UPDATE user with input (first_name, last_name, phone_number)
   * 3. LOG profile updated
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await this.userRepository.update(userId, input);
    logger.info("Profile updated", { userId }, "AuthService");
  }

  /**
   * PSEUDOCODE:
   * 1. FIND user by userId; if not found THROW NotFoundError
   * 2. COMPARE old_password with user password; if invalid THROW BadRequestError
   * 3. HASH new_password and UPDATE user password in DB (clear reset token if any)
   * 4. LOG password changed
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const { old_password, new_password } = input;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isOldPasswordValid = await comparePassword(old_password, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestError("Old password is incorrect");
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(new_password);

    // Update password
    await this.userRepository.updatePassword(userId, hashedNewPassword);
    logger.info("Password changed", { userId }, "AuthService");
  }

  /**
   * Send a single-use 6-digit code to the user's email so they can prove
   * email ownership before resetting their password. Always resolves
   * regardless of whether the email exists, to avoid user-enumeration.
   */
  async requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
    const email = input.email.toLowerCase();
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      logger.info("Password reset requested for unknown email", { email }, "AuthService");
      return;
    }

    const code = this.generatePasswordResetCode();
    const hashedCode = this.hashResetCode(code);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_TTL_MS);

    await this.userRepository.setResetCode(user._id!.toString(), hashedCode, expiresAt);

    setImmediate(() => {
      this.notificationService
        .createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.PASSWORD_RESET,
          recipientEmail: user.email,
          templateParams: {
            code,
            expiresInMinutes: String(PASSWORD_RESET_CODE_TTL_MINUTES),
            firstName: user.first_name,
          },
        })
        .then(() => {
          logger.info("Password reset email enqueued", { userId: user._id, email: user.email }, "AuthService");
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("Password reset email failed", err, { userId: user._id, email: user.email }, "AuthService");
        });
    });
  }

  /**
   * Validate a reset code without consuming it. Increments attempts on
   * mismatch; throws BadRequestError when the code is invalid, expired,
   * or attempts have been exhausted.
   */
  async verifyPasswordResetCode(input: VerifyResetCodeInput): Promise<void> {
    await this.assertResetCodeValid(input.email, input.code);
  }

  /**
   * Re-validate the reset code, then set the new password and clear all
   * reset state. The code is consumed only on a successful reset.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const { email, code, new_password } = input;
    const user = await this.assertResetCodeValid(email, code);

    const hashedNewPassword = await hashPassword(new_password);
    await this.userRepository.updatePassword(user._id!.toString(), hashedNewPassword);
    logger.info("Password reset via code", { userId: user._id, email: user.email }, "AuthService");
  }

  private async assertEmailVerificationCodeValid(user: User, code: string): Promise<void> {
    if (
      !user.email_verification_token ||
      !user.email_verification_expires ||
      user.email_verification_expires.getTime() <= Date.now()
    ) {
      throw new BadRequestError("That code is invalid or expired. Request a new one.");
    }
    if ((user.email_verification_attempts ?? 0) >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      throw new BadRequestError("Too many attempts. Request a new code.");
    }

    const hashedCode = this.hashResetCode(code);
    if (hashedCode !== user.email_verification_token) {
      const attempts = await this.userRepository.incrementEmailVerificationAttempts(user._id!.toString());
      logger.warn("Email verification code mismatch", { userId: user._id, attempts }, "AuthService");
      throw new BadRequestError("That code doesn't look right. Double-check and try again.");
    }
  }

  private async assertResetCodeValid(rawEmail: string, code: string): Promise<User> {
    const email = rawEmail.toLowerCase();
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestError("Invalid or expired code");
    }
    if (!user.resetPasswordToken || !user.resetPasswordExpires || user.resetPasswordExpires.getTime() <= Date.now()) {
      throw new BadRequestError("Invalid or expired code");
    }
    if ((user.resetPasswordAttempts ?? 0) >= PASSWORD_RESET_MAX_ATTEMPTS) {
      throw new BadRequestError("Too many attempts. Request a new code.");
    }

    const hashedCode = this.hashResetCode(code);
    if (hashedCode !== user.resetPasswordToken) {
      const attempts = await this.userRepository.incrementResetAttempts(user._id!.toString());
      logger.warn("Password reset code mismatch", { userId: user._id, attempts }, "AuthService");
      throw new BadRequestError("Invalid or expired code");
    }

    return user;
  }

  private generatePasswordResetCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  private hashResetCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /** Prefer first site for JWT context (sites are active without chat). */
  private resolveCurrentSiteId(sites: Site[]): string | undefined {
    if (sites.length === 0) return undefined;
    return sites[0]._id!.toString();
  }

  private async buildLoginResponse(user: User, sites: Site[]): Promise<LoginResponse> {
    const hasSites = sites.length > 0;
    const currentSiteId = this.resolveCurrentSiteId(sites);
    const tokenPayload = {
      userId: user._id!.toString(),
      email: user.email,
      currentSiteId,
      role: user.role ?? UserRole.USER,
    };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    await this.userRepository.updateSessionToken(user._id!.toString(), refreshToken);

    const role = user.role ?? UserRole.USER;
    const emailVerified = isEmailVerified(user);

    return {
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      user: {
        id: user._id!.toString(),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        plan: user.plan,
        role,
        email_verified: emailVerified,
        company_role: user.company_role,
      },
      requiresSiteCreation: isPlatformAdminRole(role) ? false : !hasSites,
      requires_email_verification: !emailVerified,
      requires_company_role: emailVerified && !user.company_role,
    };
  }
}

const PASSWORD_RESET_CODE_TTL_MINUTES = 15;
const PASSWORD_RESET_CODE_TTL_MS = PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const EMAIL_VERIFICATION_TTL_MINUTES = 15;
const EMAIL_VERIFICATION_TTL_MS = EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
