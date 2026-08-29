import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BetaAccessService } from "../services/beta-access.service";
import type { BetaAccessTokenInput } from "../validations/beta-access.validation";

@injectable()
export class BetaAccessController {
  constructor(private readonly betaAccessService: BetaAccessService) {}

  getContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.validatedQuery as BetaAccessTokenInput;
      const result = await this.betaAccessService.getContext(token);
      sendSuccess(res, "Beta applicant loaded", result);
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.validatedBody as BetaAccessTokenInput;
      const result = await this.betaAccessService.approve(token);
      sendSuccess(res, result.already_decided ? "This account was already approved" : "Account approved", result);
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.validatedBody as BetaAccessTokenInput;
      const result = await this.betaAccessService.reject(token);
      sendSuccess(res, result.already_decided ? "Rejection was already recorded" : "Rejection recorded", result);
    } catch (error) {
      next(error);
    }
  };
}
