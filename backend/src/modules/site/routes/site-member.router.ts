import { Router } from "express";
import { container } from "tsyringe";
import { SiteMemberController } from "../controllers/site-member.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router({ mergeParams: true }); // mergeParams to access parent route params
const siteMemberController = container.resolve(SiteMemberController);

// All routes require authentication
router.get("/", authMiddleware, siteMemberController.getMembers);
router.post("/", authMiddleware, siteMemberController.addMember);
router.patch("/:userId", authMiddleware, siteMemberController.updateMemberRole);
router.delete("/:userId", authMiddleware, siteMemberController.removeMember);

export default router;
