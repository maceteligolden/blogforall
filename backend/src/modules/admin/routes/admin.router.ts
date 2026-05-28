import { Router } from "express";
import { container } from "tsyringe";
import { AdminController } from "../controllers/admin.controller";
import {
  authMiddleware,
  requirePlatformAdmin,
  requireSuperAdmin,
} from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import {
  adminDateRangeQuerySchema,
  adminLoginSchema,
  adminPaginationQuerySchema,
  adminUserBlogsParamsSchema,
  createPlatformAdminSchema,
} from "../validations/admin.validation";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "../../auth/validations/auth.validation";

const router = Router();
const adminController = container.resolve(AdminController);

router.post("/login", validateBody(adminLoginSchema), adminController.login);

router.post("/logout", authMiddleware, requirePlatformAdmin, adminController.logout);
router.get("/dashboard/stats", authMiddleware, requirePlatformAdmin, adminController.getStats);
router.get("/profile", authMiddleware, requirePlatformAdmin, adminController.getProfile);
router.put(
  "/profile",
  authMiddleware,
  requirePlatformAdmin,
  validateBody(updateProfileSchema),
  adminController.updateProfile
);
router.put(
  "/change-password",
  authMiddleware,
  requirePlatformAdmin,
  validateBody(changePasswordSchema),
  adminController.changePassword
);
router.post(
  "/users",
  authMiddleware,
  requireSuperAdmin,
  validateBody(createPlatformAdminSchema),
  adminController.createAdminUser
);
router.get(
  "/users",
  authMiddleware,
  requirePlatformAdmin,
  validateQuery(adminPaginationQuerySchema.merge(adminDateRangeQuerySchema)),
  adminController.listUsers
);
router.get(
  "/users/:userId/blogs",
  authMiddleware,
  requirePlatformAdmin,
  validateParams(adminUserBlogsParamsSchema),
  validateQuery(adminPaginationQuerySchema),
  adminController.listUserBlogs
);
router.get(
  "/blogs",
  authMiddleware,
  requirePlatformAdmin,
  validateQuery(adminPaginationQuerySchema),
  adminController.listBlogs
);
router.get(
  "/token-usage/summary",
  authMiddleware,
  requirePlatformAdmin,
  adminController.getTokenUsageSummary
);
router.get(
  "/token-usage/daily",
  authMiddleware,
  requirePlatformAdmin,
  validateQuery(adminDateRangeQuerySchema),
  adminController.getTokenUsageDaily
);
router.get(
  "/token-usage/daily-by-user",
  authMiddleware,
  requirePlatformAdmin,
  validateQuery(adminDateRangeQuerySchema),
  adminController.getTokenUsageDailyByUser
);

export default router;
