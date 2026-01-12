import { Router } from "express";
import { container } from "tsyringe";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const subscriptionController = container.resolve(SubscriptionController);

router.get("/", authMiddleware, (req, res, next) => subscriptionController.getSubscription(req, res, next));
// Plans endpoint is public (no auth required) so users can see plans during onboarding
router.get("/plans", (req, res, next) => subscriptionController.getPlans(req, res, next));
router.post("/change-plan", authMiddleware, (req, res, next) => subscriptionController.changePlan(req, res, next));
router.post("/cancel", authMiddleware, (req, res, next) => subscriptionController.cancelSubscription(req, res, next));

export default router;
