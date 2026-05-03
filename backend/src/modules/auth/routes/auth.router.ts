import { Router } from "express";
import { container } from "tsyringe";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody } from "../../../shared/middlewares/validate.middleware";
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  updateSiteContextSchema,
  refreshTokenBodySchema,
} from "../validations/auth.validation";

const router = Router();
const authController = container.resolve(AuthController);

// Public routes
router.post("/signup", validateBody(signupSchema), authController.signup);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/refresh", validateBody(refreshTokenBodySchema), authController.refresh);

// Protected routes
router.post("/logout", authMiddleware, authController.logout);
router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, validateBody(updateProfileSchema), authController.updateProfile);
router.put("/change-password", authMiddleware, validateBody(changePasswordSchema), authController.changePassword);
router.put("/site-context", authMiddleware, validateBody(updateSiteContextSchema), authController.updateSiteContext);

export default router;
