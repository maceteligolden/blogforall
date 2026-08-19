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
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  companyRoleSchema,
} from "../validations/auth.validation";

const router = Router();
const authController = container.resolve(AuthController);

// Public routes
router.post("/signup", validateBody(signupSchema), authController.signup);
router.post("/login", validateBody(loginSchema), authController.login);
router.post("/refresh", validateBody(refreshTokenBodySchema), authController.refresh);
router.post("/forgot-password", validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post("/verify-reset-code", validateBody(verifyResetCodeSchema), authController.verifyResetCode);
router.post("/reset-password", validateBody(resetPasswordSchema), authController.resetPassword);

// Protected routes
router.post("/logout", authMiddleware, authController.logout);
router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, validateBody(updateProfileSchema), authController.updateProfile);
router.put("/change-password", authMiddleware, validateBody(changePasswordSchema), authController.changePassword);
router.put("/site-context", authMiddleware, validateBody(updateSiteContextSchema), authController.updateSiteContext);
router.post("/abandon-signup", authMiddleware, authController.abandonSignup);
router.post("/verify-email", authMiddleware, validateBody(verifyEmailSchema), authController.verifyEmail);
router.post("/resend-verification", authMiddleware, authController.resendVerification);
router.post("/company-role", authMiddleware, validateBody(companyRoleSchema), authController.setCompanyRole);

export default router;
