import { Router } from "express";
import { container } from "tsyringe";
import { OnboardingController } from "../controllers/onboarding.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody } from "../../../shared/middlewares/validate.middleware";
import { completeOnboardingBodySchema } from "../validations/onboarding.validation";

const router = Router();
const onboardingController = container.resolve(OnboardingController);

router.get("/status", authMiddleware, onboardingController.getOnboardingStatus);
router.post(
  "/complete",
  authMiddleware,
  validateBody(completeOnboardingBodySchema),
  onboardingController.completeOnboarding
);
router.post("/skip", authMiddleware, onboardingController.skipOnboarding);
router.get("/invite-prompt", authMiddleware, onboardingController.getInvitePromptStatus);
router.post("/invite-prompt/dismiss", authMiddleware, onboardingController.dismissInvitePrompt);
router.get("/signup-wizard", authMiddleware, onboardingController.getSignupWizardStatus);
router.post("/plan-selection/complete", authMiddleware, onboardingController.completePlanSelection);

export default router;
