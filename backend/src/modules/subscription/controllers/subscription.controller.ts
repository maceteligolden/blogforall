import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../services/subscription.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";

@injectable()
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { subscription, plan } = await this.subscriptionService.getActiveSubscription(userId);

      sendSuccess(res, "Subscription retrieved successfully", {
        subscription,
        plan,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await this.subscriptionService.getActivePlans();
      sendSuccess(res, "Plans retrieved successfully", plans);
    } catch (error) {
      next(error);
    }
  }

  async changePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { planId } = req.body;
      if (!planId) {
        return next(new BadRequestError("Plan ID is required"));
      }

      const subscription = await this.subscriptionService.changePlan(userId, planId);
      sendSuccess(res, "Plan changed successfully", subscription);
    } catch (error) {
      next(error);
    }
  }

  async cancelSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const subscription = await this.subscriptionService.cancelSubscription(userId);
      sendSuccess(res, "Subscription will be cancelled at the end of the billing period", subscription);
    } catch (error) {
      next(error);
    }
  }
}
