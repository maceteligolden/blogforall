import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { OnboardingService } from "../services/onboarding.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";

@injectable()
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  async getOnboardingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const status = await this.onboardingService.getOnboardingStatus(userId);
      sendSuccess(res, "Onboarding status retrieved", status);
    } catch (error) {
      next(error);
    }
  }

  async completeOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { planId, paymentMethodId } = req.body;

      if (!planId) {
        return next(new BadRequestError("Plan ID is required"));
      }

      if (!paymentMethodId) {
        return next(new BadRequestError("Payment method ID is required"));
      }

      await this.onboardingService.completeOnboarding(userId, planId, paymentMethodId);
      sendSuccess(res, "Onboarding completed successfully", { completed: true });
    } catch (error) {
      next(error);
    }
  }

  async skipOnboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      await this.onboardingService.skipOnboarding(userId);
      sendSuccess(res, "Onboarding skipped successfully", { completed: true });
    } catch (error) {
      next(error);
    }
  }
}
