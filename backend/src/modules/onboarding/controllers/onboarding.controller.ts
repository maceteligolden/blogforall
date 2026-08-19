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

  getInvitePromptStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = typeof req.query.site_id === "string" ? req.query.site_id : undefined;
      const status = await this.onboardingService.getInvitePromptStatus(userId, siteId);
      sendSuccess(res, "Invite prompt status retrieved", status);
    } catch (error) {
      next(error);
    }
  };

  dismissInvitePrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      await this.onboardingService.dismissInvitePrompt(userId);
      sendSuccess(res, "Invite prompt dismissed", { dismissed: true });
    } catch (error) {
      next(error);
    }
  };

  getSignupWizardStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const status = await this.onboardingService.getSignupWizardStatus(userId);
      sendSuccess(res, "Signup wizard status retrieved", status);
    } catch (error) {
      next(error);
    }
  };

  completePlanSelection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      await this.onboardingService.completePlanSelection(userId);
      sendSuccess(res, "Plan selection completed", { completed: true });
    } catch (error) {
      next(error);
    }
  };

  getSetupProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = typeof req.query.site_id === "string" ? req.query.site_id : undefined;
      if (!siteId) {
        sendSuccess(res, "Setup progress", {
          items: [],
          percent: 0,
          complete: true,
        });
        return;
      }
      const progress = await this.onboardingService.getSetupProgress(userId, siteId);
      sendSuccess(res, "Setup progress retrieved", progress);
    } catch (error) {
      next(error);
    }
  };

  getStrategistProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { site_id: siteId } = req.validatedQuery as { site_id: string };
      const progress = await this.onboardingService.getStrategistProgress(userId, siteId);
      sendSuccess(res, "Strategist setup progress retrieved", progress);
    } catch (error) {
      next(error);
    }
  };

  retryStrategistProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { site_id: siteId } = req.validatedQuery as { site_id: string };
      const progress = await this.onboardingService.retryStrategistProgress(userId, siteId);
      sendSuccess(res, "Strategist setup retry started", progress);
    } catch (error) {
      next(error);
    }
  };

  acknowledgeStrategistReady = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const body = (req.validatedBody as { degraded?: boolean } | undefined) ?? {};
      const status = await this.onboardingService.acknowledgeStrategistReady(userId, Boolean(body.degraded));
      sendSuccess(res, "Business strategist is ready", status);
    } catch (error) {
      next(error);
    }
  };
}
