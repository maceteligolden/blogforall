import { Router } from "express";
import { container } from "tsyringe";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const subscriptionController = container.resolve(SubscriptionController);

router.get("/", authMiddleware, subscriptionController.getSubscription);
// Plans endpoint is public (no auth required) so users can see plans during onboarding
router.get("/plans", subscriptionController.getPlans);
router.post("/change-plan", authMiddleware, subscriptionController.changePlan);
router.post("/cancel", authMiddleware, subscriptionController.cancelSubscription);

export default router;
