import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AuthService } from "../services/auth.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateSiteContextSchema,
} from "../validations/auth.validation";

@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  /** PSEUDOCODE: PARSE body with signupSchema; CALL authService.signup; SEND 201; ON ZodError next(BadRequestError). */
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

  /** PSEUDOCODE: PARSE body with loginSchema; CALL authService.login; SEND 200 with result; ON ZodError next(BadRequestError). */
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

  /** PSEUDOCODE: GET userId from req.user; if missing next(BadRequestError); CALL authService.logout; SEND 204. */
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

  /** PSEUDOCODE: GET refresh_token from body; if missing next(BadRequestError); CALL authService.refreshToken; SEND 200 with result. */
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

  /** PSEUDOCODE: GET userId from req.user; if missing next(BadRequestError); CALL authService.getProfile; SEND 200 with profile. */
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

  /** PSEUDOCODE: GET userId from req.user; PARSE body with updateProfileSchema; CALL authService.updateProfile; SEND 204. */
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

  /** PSEUDOCODE: GET userId from req.user; PARSE body with changePasswordSchema; CALL authService.changePassword; SEND 204. */
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

  /** PSEUDOCODE: GET userId from req.user; PARSE body with updateSiteContextSchema; CALL authService.updateSiteContext; SEND 200 with new token. */
  updateSiteContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }
      const validatedData = updateSiteContextSchema.parse(req.body);
      const result = await this.authService.updateSiteContext(userId, validatedData.site_id);
      sendSuccess(res, "Site context updated successfully", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };
}
