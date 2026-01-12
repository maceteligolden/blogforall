import { Request, Response, NextFunction } from "express";
import User from "../schemas/user.schema";
import { UnauthorizedError } from "../errors";

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

    const user = await User.findById(userId);
    if (!user) {
      return next(new UnauthorizedError("User not found"));
    }

    // Check if onboarding is completed
    if (!user.onboarding_completed) {
      // Return a flag that frontend can check
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
