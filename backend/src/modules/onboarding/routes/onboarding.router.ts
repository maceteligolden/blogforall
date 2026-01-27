import { Router } from "express";
import { container } from "tsyringe";
import { OnboardingController } from "../controllers/onboarding.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const onboardingController = container.resolve(OnboardingController);

router.get("/status", authMiddleware, (req, res, next) => onboardingController.getOnboardingStatus(req, res, next));
router.post("/complete", authMiddleware, (req, res, next) => onboardingController.completeOnboarding(req, res, next));
router.post("/skip", authMiddleware, (req, res, next) => onboardingController.skipOnboarding(req, res, next));

export default router;
