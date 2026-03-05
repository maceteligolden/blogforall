import { Router } from "express";
import { container } from "tsyringe";
import { SiteController } from "../controllers/site.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import { createSiteSchema, updateSiteSchema, siteIdParamSchema } from "../validations/site.validation";
import siteMemberRouter from "./site-member.router";
import siteInvitationRouter from "./site-invitation.router";

const router = Router();
const siteController = container.resolve(SiteController);

// All routes require authentication
router.post("/", authMiddleware, validateBody(createSiteSchema), siteController.create);
router.post("/ensure-default", authMiddleware, siteController.ensureDefault);
router.get("/", authMiddleware, siteController.list);
router.get("/:id", authMiddleware, validateParams(siteIdParamSchema), siteController.getById);
router.patch("/:id", authMiddleware, validateParams(siteIdParamSchema), validateBody(updateSiteSchema), siteController.update);
router.delete("/:id", authMiddleware, validateParams(siteIdParamSchema), siteController.delete);

// Site member routes (nested under /sites/:id/members)
router.use("/:id/members", siteMemberRouter);

// Site invitation routes (nested under /sites/:id/invitations)
router.use("/:id/invitations", siteInvitationRouter);

export default router;
