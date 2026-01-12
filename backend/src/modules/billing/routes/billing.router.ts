import { Router } from "express";
import { container } from "tsyringe";
import { BillingController } from "../controllers/billing.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const billingController = container.resolve(BillingController);

router.post("/cards/initialize", authMiddleware, (req, res, next) => billingController.initializeAddCard(req, res, next));
router.post("/cards/confirm", authMiddleware, (req, res, next) => billingController.confirmCard(req, res, next));
router.get("/cards", authMiddleware, (req, res, next) => billingController.fetchCards(req, res, next));
router.delete("/cards/:id", authMiddleware, (req, res, next) => billingController.deleteCard(req, res, next));
router.put("/cards/:id/default", authMiddleware, (req, res, next) => billingController.setDefaultCard(req, res, next));

export default router;
