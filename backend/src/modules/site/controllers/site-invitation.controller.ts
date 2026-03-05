import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteInvitationService } from "../services/site-invitation.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { CreateInvitationInput } from "../interfaces/site-invitation.interface";
import { InvitationStatus } from "../../../shared/constants";

@injectable()
export class SiteInvitationController {
  constructor(private invitationService: SiteInvitationService) {}

  createInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId } = req.validatedParams as { id: string };
      const body = req.validatedBody as CreateInvitationInput;
      const invitation = await this.invitationService.createInvitation(siteId, userId, body);
      sendCreated(res, "Invitation sent successfully", invitation);
    } catch (error) {
      next(error);
    }
  };

  getSiteInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId } = req.validatedParams as { id: string };
      const status = req.query.status as string | undefined;
      const statusFilter = status && Object.values(InvitationStatus).includes(status as InvitationStatus) ? (status as InvitationStatus) : undefined;
      const invitations = await this.invitationService.getSiteInvitations(siteId, userId, statusFilter);
      sendSuccess(res, "Invitations retrieved successfully", invitations);
    } catch (error) {
      next(error);
    }
  };

  getUserInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as string | undefined;
      const statusFilter = status && Object.values(InvitationStatus).includes(status as InvitationStatus) ? (status as InvitationStatus) : undefined;
      const invitations = await this.invitationService.getUserInvitations(userId, statusFilter);
      sendSuccess(res, "Invitations retrieved successfully", invitations);
    } catch (error) {
      next(error);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { token } = req.validatedParams as { token: string };
      await this.invitationService.acceptInvitation(token, userId);
      sendSuccess(res, "Invitation accepted successfully", null);
    } catch (error) {
      next(error);
    }
  };

  rejectInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { token } = req.validatedParams as { token: string };
      await this.invitationService.rejectInvitation(token, userId);
      sendNoContent(res, "Invitation rejected successfully");
    } catch (error) {
      next(error);
    }
  };

  cancelInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id: siteId, invitationId } = req.validatedParams as { id: string; invitationId: string };
      await this.invitationService.cancelInvitation(siteId, invitationId, userId);
      sendNoContent(res, "Invitation cancelled successfully");
    } catch (error) {
      next(error);
    }
  };
}
