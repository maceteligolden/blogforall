import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteMemberService } from "../services/site-member.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { addMemberSchema, updateMemberRoleSchema } from "../validations/site-member.validation";

@injectable()
export class SiteMemberController {
  constructor(private siteMemberService: SiteMemberService) {}

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId } = req.params;
      const validatedData = addMemberSchema.parse(req.body);
      const member = await this.siteMemberService.addMember(siteId, userId, validatedData);
      sendCreated(res, "Member added successfully", member);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId } = req.params;
      const members = await this.siteMemberService.getMembers(siteId, userId);
      sendSuccess(res, "Members retrieved successfully", members);
    } catch (error) {
      next(error);
    }
  };

  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId, userId: targetUserId } = req.params;
      const validatedData = updateMemberRoleSchema.parse(req.body);
      const member = await this.siteMemberService.updateMemberRole(siteId, targetUserId, userId, validatedData);
      sendSuccess(res, "Member role updated successfully", member);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId, userId: targetUserId } = req.params;
      await this.siteMemberService.removeMember(siteId, targetUserId, userId);
      sendNoContent(res, "Member removed successfully");
    } catch (error) {
      next(error);
    }
  };
}
