import { injectable } from "tsyringe";
import { UserRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../../../shared/utils/password";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../../../shared/utils/token";
import { BadRequestError, UnauthorizedError, NotFoundError } from "../../../shared/errors";
import { UserPlan } from "../../../shared/constants";
import { logger } from "../../../shared/utils/logger";
import {
  SignupInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
  LoginResponse,
} from "../interfaces/auth.interface";
import { User } from "../../../shared/schemas/user.schema";
import { StripeFacade } from "../../../shared/facade/stripe.facade";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { SiteService } from "../../site/services/site.service";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";

@injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private stripeFacade: StripeFacade,
    private subscriptionService: SubscriptionService,
    private siteService: SiteService,
    private notificationService: NotificationService
  ) {}

  /**
   * PSEUDOCODE:
   * 1. CHECK existing user by email; if exists THROW BadRequestError
   * 2. HASH password
   * 3. TRY create Stripe customer; on failure LOG and continue
   * 4. CREATE user with hashed password, plan FREE, terms_accepted_at (now), terms_version from input
   * 5. TRY create free subscription; on failure LOG and continue
   * 6. TRY ensure default workspace; on failure LOG and continue
   * 7. TRY send welcome email via NotificationService (async queue); on failure LOG and continue
   * 8. LOG success and RETURN user
   */
  async signup(input: SignupInput): Promise<User> {
    const { email, password, first_name, last_name, phone_number, terms_version } = input;

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      logger.warn("Signup attempt with existing email", { email }, "AuthService");
      throw new BadRequestError("User with this email already exists");
    }

    const hashedPassword = await hashPassword(password);

    let stripeCustomerId: string | undefined;
    try {
      const customer = await this.stripeFacade.createCustomer(email.toLowerCase(), `${first_name} ${last_name}`.trim());
      stripeCustomerId = customer.id;
    } catch (error) {
      logger.error("Failed to create Stripe customer", error as Error, { email }, "AuthService");
    }

    const user = await this.userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      first_name,
      last_name,
      phone_number,
      plan: UserPlan.FREE,
      stripe_customer_id: stripeCustomerId,
      terms_accepted_at: new Date(),
      terms_version: terms_version ?? undefined,
    });

    // Create free subscription for new user
    try {
      await this.subscriptionService.createFreeSubscription(user._id!.toString());
    } catch (error) {
      logger.error("Failed to create free subscription on signup", error as Error, { userId: user._id }, "AuthService");
      // Continue even if subscription creation fails - can be created later
    }

    // Ensure user has a default workspace (uses env.workspace.defaultName)
    try {
      await this.siteService.ensureDefaultWorkspace(user._id!.toString());
      logger.info("Default workspace ensured for new user", { userId: user._id, email }, "AuthService");
    } catch (error) {
      logger.error("Failed to create default workspace on signup", error as Error, { userId: user._id }, "AuthService");
    }

    const frontendBase = process.env.FRONTEND_URL?.split(",")[0]?.trim() || "http://localhost:3000";
    const loginUrl = `${frontendBase}/auth/login`;
    try {
      await this.notificationService.createAndSend({
        channel: NotificationChannel.EMAIL,
        type: NotificationType.WELCOME,
        recipientEmail: user.email,
        templateParams: {
          firstName: user.first_name,
          loginUrl,
        },
      });
    } catch (error) {
      logger.error("Failed to send welcome email on signup", error as Error, { userId: user._id, email }, "AuthService");
    }

    logger.info("User signed up successfully", { userId: user._id, email, stripeCustomerId }, "AuthService");
    return user;
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

    const userSites = await this.siteService.getSitesByUser(user._id!.toString());
    const hasSites = userSites.length > 0;
    const defaultSiteId = hasSites ? userSites[0]._id!.toString() : undefined;

    // Generate tokens with site context
    const accessToken = generateAccessToken({
      userId: user._id!.toString(),
      email: user.email,
      currentSiteId: defaultSiteId,
    });
    const refreshToken = generateRefreshToken({
      userId: user._id!.toString(),
      email: user.email,
      currentSiteId: defaultSiteId,
    });

    // Update session token
    await this.userRepository.updateSessionToken(user._id!.toString(), refreshToken);

    logger.info("User logged in successfully", { userId: user._id, email, hasSites }, "AuthService");

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
      },
      requiresSiteCreation: !hasSites,
    };
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

    // Generate new access token with updated site context
    const accessToken = generateAccessToken({
      userId: user._id!.toString(),
      email: user.email,
      currentSiteId: siteId,
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
}
