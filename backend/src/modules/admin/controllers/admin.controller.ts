import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { AuthService } from "../../auth/services/auth.service";
import { AdminStatsService } from "../services/admin-stats.service";
import { AdminUserService } from "../services/admin-user.service";
import { AdminBlogsService } from "../services/admin-blogs.service";
import { AdminTokenUsageService } from "../services/admin-token-usage.service";
import { sendCreated, sendSuccess, sendNoContent } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { LoginInput, UpdateProfileInput, ChangePasswordInput } from "../../auth/interfaces/auth.interface";
import type {
  AdminDateRangeQueryInput,
  AdminLoginInput,
  AdminPaginationQueryInput,
  AdminUserBlogsParamsInput,
  CreatePlatformAdminInput,
} from "../validations/admin.validation";

@injectable()
export class AdminController {
  constructor(
    private authService: AuthService,
    private adminStatsService: AdminStatsService,
    private adminUserService: AdminUserService,
    private adminBlogsService: AdminBlogsService,
    private adminTokenUsageService: AdminTokenUsageService
  ) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.validatedBody as AdminLoginInput;
      const result = await this.authService.loginPlatformAdmin(body as LoginInput);
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

  getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.adminStatsService.getDashboardStats();
      sendSuccess(res, "Dashboard stats retrieved", stats);
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
      const body = req.validatedBody as UpdateProfileInput;
      await this.authService.updateProfile(userId, body);
      sendNoContent(res, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const body = req.validatedBody as ChangePasswordInput;
      await this.authService.changePassword(userId, body);
      sendNoContent(res, "Password changed successfully");
    } catch (error) {
      next(error);
    }
  };

  createAdminUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.validatedBody as CreatePlatformAdminInput;
      const user = await this.adminUserService.createPlatformAdmin(body);
      sendCreated(res, "Platform admin created", user);
    } catch (error) {
      next(error);
    }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.validatedQuery as AdminPaginationQueryInput & AdminDateRangeQueryInput;
      const result = await this.adminUserService.listUsers(query, query);
      sendSuccess(res, "Users retrieved", result);
    } catch (error) {
      next(error);
    }
  };

  listBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.validatedQuery as AdminPaginationQueryInput;
      const result = await this.adminBlogsService.listBlogs(query);
      sendSuccess(res, "Blogs retrieved", result);
    } catch (error) {
      next(error);
    }
  };

  listUserBlogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.validatedParams as AdminUserBlogsParamsInput;
      const query = req.validatedQuery as AdminPaginationQueryInput;
      const result = await this.adminBlogsService.listBlogsByUser(userId, query);
      sendSuccess(res, "User blogs retrieved", result);
    } catch (error) {
      next(error);
    }
  };

  getTokenUsageSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.adminTokenUsageService.getSummary();
      sendSuccess(res, "Token usage summary retrieved", result);
    } catch (error) {
      next(error);
    }
  };

  getTokenUsageDaily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.validatedQuery as AdminDateRangeQueryInput;
      const result = await this.adminTokenUsageService.getDailyUsage(query);
      sendSuccess(res, "Daily token usage retrieved", result);
    } catch (error) {
      next(error);
    }
  };

  getTokenUsageDailyByUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.validatedQuery as AdminDateRangeQueryInput;
      const result = await this.adminTokenUsageService.getDailyUsageByUser(query);
      sendSuccess(res, "Daily token usage by user retrieved", result);
    } catch (error) {
      next(error);
    }
  };
}
