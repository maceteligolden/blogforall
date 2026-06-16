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

export default router;
