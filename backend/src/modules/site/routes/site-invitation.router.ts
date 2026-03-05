import { Router } from "express";
import { container } from "tsyringe";
import { SiteInvitationController } from "../controllers/site-invitation.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import {
  createInvitationSchema,
  siteInvitationCancelParamSchema,
} from "../validations/site-invitation.validation";
import { siteIdParamSchema } from "../validations/site.validation";

const router = Router({ mergeParams: true });
const invitationController = container.resolve(SiteInvitationController);

// Site-specific invitation routes (nested under /sites/:id/invitations)
router.post("/", authMiddleware, validateParams(siteIdParamSchema), validateBody(createInvitationSchema), invitationController.createInvitation);
router.get("/", authMiddleware, validateParams(siteIdParamSchema), invitationController.getSiteInvitations);
router.delete("/:invitationId", authMiddleware, validateParams(siteInvitationCancelParamSchema), invitationController.cancelInvitation);

export default router;
