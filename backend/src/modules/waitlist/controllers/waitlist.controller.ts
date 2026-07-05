import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { sendCreated } from "../../../shared/helper/response.helper";
import { WaitlistService } from "../services/waitlist.service";
import { JoinWaitlistInput } from "../validations/waitlist.validation";

@injectable()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  join = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, first_name, last_name } = req.validatedBody as JoinWaitlistInput;
      const result = await this.waitlistService.joinWaitlist(email, first_name, last_name);
      sendCreated(res, "You're on the waitlist.", result);
    } catch (error: unknown) {
      next(error);
    }
  };
}
