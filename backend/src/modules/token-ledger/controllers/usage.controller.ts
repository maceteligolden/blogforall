import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { TokenEnforcementService } from "../services/token-enforcement.service";

@injectable()
export class UsageController {
  constructor(private readonly tokenEnforcement: TokenEnforcementService) {}

  getTokenUsage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const balance = await this.tokenEnforcement.getBalance(userId);
      sendSuccess(res, "Token usage retrieved", balance);
    } catch (error) {
      next(error);
    }
  };
}
