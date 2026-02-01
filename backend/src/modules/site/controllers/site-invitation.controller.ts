import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { SiteInvitationService } from "../services/site-invitation.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import { createInvitationSchema } from "../validations/site-invitation.validation";

@injectable()
export class SiteInvitationController {
  constructor(private invitationService: SiteInvitationService) {}

  createInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId } = req.params;
      const validatedData = createInvitationSchema.parse(req.body);
      const invitation = await this.invitationService.createInvitation(siteId, userId, validatedData);
      sendCreated(res, "Invitation sent successfully", invitation);
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ");
        return next(new BadRequestError(errorMessages));
      }
      next(error);
    }
  };

  getSiteInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: siteId } = req.params;
      const status = req.query.status as string | undefined;
      const invitations = await this.invitationService.getSiteInvitations(siteId, userId, status as any);
      sendSuccess(res, "Invitations retrieved successfully", invitations);
    } catch (error) {
      next(error);
    }
  };

  getUserInvitations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const status = req.query.status as string | undefined;
      const invitations = await this.invitationService.getUserInvitations(userId, status as any);
      sendSuccess(res, "Invitations retrieved successfully", invitations);
    } catch (error) {
      next(error);
    }
  };

  acceptInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { token } = req.params;
      await this.invitationService.acceptInvitation(token, userId);
      sendSuccess(res, "Invitation accepted successfully", null);
    } catch (error) {
      next(error);
    }
  };

  rejectInvitation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { token } = req.params;
      await this.invitationService.rejectInvitation(token, userId);
      sendNoContent(res, "Invitation rejected successfully");
    } catch (error) {
      next(error);
    }
  };
}
