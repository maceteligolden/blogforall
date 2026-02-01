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

@injectable()
export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private stripeFacade: StripeFacade,
    private subscriptionService: SubscriptionService,
    private siteService: SiteService
  ) {}

  async signup(input: SignupInput): Promise<User> {
    const { email, password, first_name, last_name, phone_number } = input;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      logger.warn("Signup attempt with existing email", { email }, "AuthService");
      throw new BadRequestError("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create Stripe customer
    let stripeCustomerId: string | undefined;
    try {
      const customer = await this.stripeFacade.createCustomer(email.toLowerCase(), `${first_name} ${last_name}`.trim());
      stripeCustomerId = customer.id;
    } catch (error) {
      logger.error("Failed to create Stripe customer", error as Error, { email }, "AuthService");
      // Continue without Stripe customer - can be created later
    }

    // Create user with default free plan
    const user = await this.userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      first_name,
      last_name,
      phone_number,
      plan: UserPlan.FREE,
      stripe_customer_id: stripeCustomerId,
    });

    // Create free subscription for new user
    try {
      await this.subscriptionService.createFreeSubscription(user._id!.toString());
    } catch (error) {
      logger.error("Failed to create free subscription on signup", error as Error, { userId: user._id }, "AuthService");
      // Continue even if subscription creation fails - can be created later
    }

    // Create default site for new user
    try {
      const siteName = `${first_name}'s Site`;
      await this.siteService.createSite(user._id!.toString(), {
        name: siteName,
        description: "Default site",
      });
      logger.info("Default site created for new user", { userId: user._id, email }, "AuthService");
    } catch (error) {
      logger.error("Failed to create default site on signup", error as Error, { userId: user._id }, "AuthService");
      // Continue even if site creation fails - user can create one later
    }

    logger.info("User signed up successfully", { userId: user._id, email, stripeCustomerId }, "AuthService");
    return user;
  }

  async login(input: LoginInput): Promise<LoginResponse> {
    const { email, password } = input;

    // Find user
    const user = await this.userRepository.findByEmail(email.toLowerCase());
    if (!user) {
      logger.warn("Failed login attempt - user not found", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      logger.warn("Failed login attempt - invalid password", { email }, "AuthService");
      throw new UnauthorizedError("Invalid credentials");
    }

    // Check if user has any sites (for first-time login after migration)
    const userSites = await this.siteService.getSitesByUser(user._id!.toString());
    const hasSites = userSites.length > 0;

    // If user doesn't have sites, create a default site
    if (!hasSites) {
      try {
        const siteName = `${user.first_name}'s Site`;
        await this.siteService.createSite(user._id!.toString(), {
          name: siteName,
          description: "Default site",
        });
        logger.info("Default site created for existing user on first login", { userId: user._id, email }, "AuthService");
        // Refresh user sites after creating default site
        const updatedUserSites = await this.siteService.getSitesByUser(user._id!.toString());
        userSites.push(...updatedUserSites);
      } catch (error) {
        logger.error("Failed to create default site on login", error as Error, { userId: user._id }, "AuthService");
        // Continue even if site creation fails - user can create one later
      }
    }

    // Get user's default site (first site) for token context
    const defaultSiteId = userSites.length > 0 ? userSites[0]._id!.toString() : undefined;

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

  async logout(userId: string): Promise<void> {
    await this.userRepository.updateSessionToken(userId, null);
    logger.info("User logged out", { userId }, "AuthService");
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await this.userRepository.findById(decoded.userId);

      if (!user || user.sessionToken !== refreshToken) {
        throw new UnauthorizedError("Invalid refresh token");
      }

      // Get user's default site for token context (or use existing from token)
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
   * Update the current site context in the user's session
   * This generates a new access token with the updated site context
   */
  async updateSiteContext(userId: string, siteId: string): Promise<{ access_token: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Verify user has access to the site
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

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    await this.userRepository.update(userId, input);
    logger.info("Profile updated", { userId }, "AuthService");
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const { old_password, new_password } = input;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Verify old password
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
