import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AuthService } from "../services/auth.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { signupSchema, loginSchema, updateProfileSchema, changePasswordSchema } from "../validations/auth.validation";

@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = signupSchema.parse(req.body);
      await this.authService.signup(validatedData);
      sendCreated(res, "User created successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await this.authService.login(validatedData);
      sendSuccess(res, "Login successful", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      await this.authService.logout(userId);
      sendNoContent(res, "Logout successful");
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;
      if (!refresh_token) {
        return next(new BadRequestError("Refresh token is required"));
      }
      const result = await this.authService.refreshToken(refresh_token);
      sendSuccess(res, "Token refreshed successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const profile = await this.authService.getProfile(userId);
      sendSuccess(res, "Profile retrieved successfully", profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const validatedData = updateProfileSchema.parse(req.body);
      await this.authService.updateProfile(userId, validatedData);
      sendNoContent(res, "Profile updated successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const validatedData = changePasswordSchema.parse(req.body);
      await this.authService.changePassword(userId, validatedData);
      sendNoContent(res, "Password changed successfully");
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };
}
