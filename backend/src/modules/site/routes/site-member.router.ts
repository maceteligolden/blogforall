import { Router } from "express";
import { container } from "tsyringe";
import { SiteMemberController } from "../controllers/site-member.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import { siteIdParamSchema } from "../validations/site.validation";
import {
  addMemberSchema,
  updateMemberRoleSchema,
  siteIdAndUserIdParamSchema,
} from "../validations/site-member.validation";

const router = Router({ mergeParams: true }); // mergeParams to access parent route params
const siteMemberController = container.resolve(SiteMemberController);

// All routes require authentication
router.get("/", authMiddleware, validateParams(siteIdParamSchema), siteMemberController.getMembers);
router.post(
  "/",
  authMiddleware,
  validateParams(siteIdParamSchema),
  validateBody(addMemberSchema),
  siteMemberController.addMember
);
router.patch(
  "/:userId",
  authMiddleware,
  validateParams(siteIdAndUserIdParamSchema),
  validateBody(updateMemberRoleSchema),
  siteMemberController.updateMemberRole
);
router.delete(
  "/:userId",
  authMiddleware,
  validateParams(siteIdAndUserIdParamSchema),
  siteMemberController.removeMember
);

export default router;
