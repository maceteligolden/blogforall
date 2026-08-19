import { Router } from "express";
import { container } from "tsyringe";
import { OnboardingController } from "../controllers/onboarding.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateQuery } from "../../../shared/middlewares/validate.middleware";
import {
  acknowledgeStrategistReadyBodySchema,
  completeOnboardingBodySchema,
  siteIdQuerySchema,
} from "../validations/onboarding.validation";

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
router.get("/setup-progress", authMiddleware, onboardingController.getSetupProgress);
router.get(
  "/strategist-progress",
  authMiddleware,
  validateQuery(siteIdQuerySchema),
  onboardingController.getStrategistProgress
);
router.post(
  "/strategist-bootstrap",
  authMiddleware,
  validateQuery(siteIdQuerySchema),
  onboardingController.startStrategistBootstrap
);
router.post(
  "/strategist-progress/retry",
  authMiddleware,
  validateQuery(siteIdQuerySchema),
  onboardingController.retryStrategistProgress
);
router.post(
  "/strategist-ready/acknowledge",
  authMiddleware,
  validateBody(acknowledgeStrategistReadyBodySchema),
  onboardingController.acknowledgeStrategistReady
);

export default router;
