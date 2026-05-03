import { Router } from "express";
import { container } from "tsyringe";
import { SubscriptionController } from "../controllers/subscription.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody } from "../../../shared/middlewares/validate.middleware";
import { changePlanBodySchema } from "../validations/subscription.validation";

const router = Router();
const subscriptionController = container.resolve(SubscriptionController);

router.get("/plans", subscriptionController.getPlans);
router.get("/", authMiddleware, subscriptionController.getSubscription);
router.post("/change-plan", authMiddleware, validateBody(changePlanBodySchema), subscriptionController.changePlan);
router.post("/cancel", authMiddleware, subscriptionController.cancelSubscription);

export default router;
