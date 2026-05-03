import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { SignupInput, LoginInput, UpdateProfileInput, ChangePasswordInput } from "../interfaces/auth.interface";

type SignupBody = SignupInput;
type LoginBody = LoginInput;
type RefreshBody = { refresh_token: string };

@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = req.validatedBody as SignupBody;
      await this.authService.signup(validatedData);
      sendCreated(res, "User created successfully");
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = req.validatedBody as LoginBody;
      const result = await this.authService.login(validatedData);
      sendSuccess(res, "Login successful", result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      await this.authService.logout(userId);
      sendNoContent(res, "Logout successful");
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.validatedBody as RefreshBody;
      const result = await this.authService.refreshToken(refresh_token);
      sendSuccess(res, "Token refreshed successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const profile = await this.authService.getProfile(userId);
      sendSuccess(res, "Profile retrieved successfully", profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const validatedData = req.validatedBody as UpdateProfileInput;
      await this.authService.updateProfile(userId, validatedData);
      sendNoContent(res, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const validatedData = req.validatedBody as ChangePasswordInput;
      await this.authService.changePassword(userId, validatedData);
      sendNoContent(res, "Password changed successfully");
    } catch (error) {
      next(error);
    }
  };

  updateSiteContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const validatedData = req.validatedBody as { site_id: string };
      const result = await this.authService.updateSiteContext(userId, validatedData.site_id);
      sendSuccess(res, "Site context updated successfully", result);
    } catch (error) {
      next(error);
    }
  };
}
