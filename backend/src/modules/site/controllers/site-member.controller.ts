import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteMemberService } from "../services/site-member.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { AddMemberInput, UpdateMemberRoleInput } from "../interfaces/site-member.interface";

@injectable()
export class SiteMemberController {
  constructor(private siteMemberService: SiteMemberService) {}

  addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId } = req.validatedParams as { id: string };
      const body = req.validatedBody as AddMemberInput;
      const member = await this.siteMemberService.addMember(siteId, userId, body);
      sendCreated(res, "Member added successfully", member);
    } catch (error) {
      next(error);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId } = req.validatedParams as { id: string };
      const members = await this.siteMemberService.getMembers(siteId, userId);
      sendSuccess(res, "Members retrieved successfully", members);
    } catch (error) {
      next(error);
    }
  };

  updateMemberRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId, userId: targetUserId } = req.validatedParams as { id: string; userId: string };
      const body = req.validatedBody as UpdateMemberRoleInput;
      const member = await this.siteMemberService.updateMemberRole(siteId, targetUserId, userId, body);
      sendSuccess(res, "Member role updated successfully", member);
    } catch (error) {
      next(error);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId, userId: targetUserId } = req.validatedParams as { id: string; userId: string };
      await this.siteMemberService.removeMember(siteId, targetUserId, userId);
      sendNoContent(res, "Member removed successfully");
    } catch (error) {
      next(error);
    }
  };
}
