import { Router } from "express";
import { container } from "tsyringe";
import { SiteInvitationController } from "../controllers/site-invitation.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router({ mergeParams: true });
const invitationController = container.resolve(SiteInvitationController);

// Site-specific invitation routes (nested under /sites/:id/invitations)
router.post("/", authMiddleware, invitationController.createInvitation);
router.get("/", authMiddleware, invitationController.getSiteInvitations);

export default router;
