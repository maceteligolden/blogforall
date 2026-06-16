import { Router } from "express";
import { container } from "tsyringe";
import { SiteInvitationController } from "../controllers/site-invitation.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateParams } from "../../../shared/middlewares/validate.middleware";
import { invitationTokenParamSchema } from "../validations/site-invitation.validation";

const router = Router();
const invitationController = container.resolve(SiteInvitationController);

// Current user's invitations (accept/reject by token)
router.get("/", authMiddleware, invitationController.getUserInvitations);
router.post(
  "/:token/accept",
  authMiddleware,
  validateParams(invitationTokenParamSchema),
  invitationController.acceptInvitation
);
router.post(
  "/:token/reject",
  authMiddleware,
  validateParams(invitationTokenParamSchema),
  invitationController.rejectInvitation
);

export default router;
