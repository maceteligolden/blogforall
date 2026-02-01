import { Router } from "express";
import { container } from "tsyringe";
import { SiteController } from "../controllers/site.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import siteMemberRouter from "./site-member.router";
import siteInvitationRouter from "./site-invitation.router";

const router = Router();
const siteController = container.resolve(SiteController);

// All routes require authentication
router.post("/", authMiddleware, siteController.create);
router.get("/", authMiddleware, siteController.list);
router.get("/:id", authMiddleware, siteController.getById);
router.patch("/:id", authMiddleware, siteController.update);
router.delete("/:id", authMiddleware, siteController.delete);

// Site member routes (nested under /sites/:id/members)
router.use("/:id/members", siteMemberRouter);

// Site invitation routes (nested under /sites/:id/invitations)
router.use("/:id/invitations", siteInvitationRouter);

export default router;
