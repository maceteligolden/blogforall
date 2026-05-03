import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";

@injectable()
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  getSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { subscription, plan } = await this.subscriptionService.getActiveSubscription(userId);

      sendSuccess(res, "Subscription retrieved successfully", {
        subscription,
        plan,
      });
    } catch (error) {
      next(error);
    }
  };

  getPlans = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plans = await this.subscriptionService.getActivePlans();
      sendSuccess(res, "Plans retrieved successfully", plans);
    } catch (error) {
      next(error);
    }
  };

  changePlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { planId } = req.validatedBody as { planId: string };
      const subscription = await this.subscriptionService.changePlan(userId, planId);
      sendSuccess(res, "Plan changed successfully", subscription);
    } catch (error) {
      next(error);
    }
  };

  cancelSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const subscription = await this.subscriptionService.cancelSubscription(userId);
      sendSuccess(res, "Subscription will be cancelled at the end of the billing period", subscription);
    } catch (error) {
      next(error);
    }
  };
}
