import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { OnboardingService } from "../services/onboarding.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";

@injectable()
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  getOnboardingStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const status = await this.onboardingService.getOnboardingStatus(userId);
      sendSuccess(res, "Onboarding status retrieved", status);
    } catch (error) {
      next(error);
    }
  };

  completeOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { planId, paymentMethodId } = req.validatedBody as { planId: string; paymentMethodId: string };
      await this.onboardingService.completeOnboarding(userId, planId, paymentMethodId);
      sendSuccess(res, "Onboarding completed successfully", { completed: true });
    } catch (error) {
      next(error);
    }
  };

  skipOnboarding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      await this.onboardingService.skipOnboarding(userId);
      sendSuccess(res, "Onboarding skipped successfully", { completed: true });
    } catch (error) {
      next(error);
    }
  };
}
