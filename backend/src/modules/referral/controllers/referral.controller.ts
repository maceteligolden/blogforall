import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ReferralService } from "../services/referral.service";
import { sendSuccess } from "../../../shared/helper/response.helper";

@injectable()
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  getDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dashboard = await this.referralService.getReferralDashboard(userId);
      sendSuccess(res, "Referral dashboard retrieved", dashboard);
    } catch (error: unknown) {
      next(error);
    }
  };
}
