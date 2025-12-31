import { injectable } from "tsyringe";
import { UserRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword } from "../../../shared/utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../../shared/utils/token";
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

@injectable()
export class AuthService {
  constructor(private userRepository: UserRepository) {}

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

    // Create user with default free plan
    const user = await this.userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      first_name,
      last_name,
      phone_number,
      plan: UserPlan.FREE,
    });

    logger.info("User signed up successfully", { userId: user._id, email }, "AuthService");
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

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id!.toString(),
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      userId: user._id!.toString(),
      email: user.email,
    });

    // Update session token
    await this.userRepository.updateSessionToken(user._id!.toString(), refreshToken);

    logger.info("User logged in successfully", { userId: user._id, email }, "AuthService");

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

      const accessToken = generateAccessToken({
        userId: user._id!.toString(),
        email: user.email,
      });

      return { access_token: accessToken };
    } catch (error) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
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

