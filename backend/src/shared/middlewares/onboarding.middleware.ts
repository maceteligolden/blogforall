import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { UnauthorizedError } from "../errors";
import { UserRepository } from "../../modules/auth/repositories/user.repository";

/**
 * Middleware to check if user has completed onboarding
 * Redirects to onboarding if not completed
 */
export const onboardingMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return next(new UnauthorizedError("User not authenticated"));
    }

    const user = await container.resolve(UserRepository).findById(userId);
    if (!user) {
      return next(new UnauthorizedError("User not found"));
    }

    if (!user.onboarding_completed) {
      res.status(403).json({
        success: false,
        message: "Onboarding required",
        data: {
          requiresOnboarding: true,
        },
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
